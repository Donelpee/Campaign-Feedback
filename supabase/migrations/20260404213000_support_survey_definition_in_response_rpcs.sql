CREATE OR REPLACE FUNCTION public.extract_campaign_questions(survey JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN survey IS NULL OR survey = 'null'::jsonb THEN '[]'::jsonb
    WHEN jsonb_typeof(survey) = 'array' THEN survey
    WHEN jsonb_typeof(survey) = 'object'
      AND jsonb_typeof(survey -> 'questions') = 'array'
    THEN survey -> 'questions'
    ELSE '[]'::jsonb
  END
$$;

CREATE OR REPLACE FUNCTION public.get_feedback_response_summary(
  p_company_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped_links AS (
    SELECT
      ccl.id,
      ccl.company_id,
      ccl.campaign_id,
      ccl.access_count,
      comp.name AS company_name,
      camp.name AS campaign_name,
      public.extract_campaign_questions(camp.questions) AS campaign_questions
    FROM public.company_campaign_links ccl
    JOIN public.companies comp ON comp.id = ccl.company_id
    JOIN public.campaigns camp ON camp.id = ccl.campaign_id
    WHERE public.can_view_campaign_responses(auth.uid(), ccl.campaign_id)
      AND (
        p_company_id IS NULL
        OR (
          ccl.company_id = p_company_id
          AND public.has_company_access(auth.uid(), p_company_id)
        )
      )
      AND (
        p_campaign_id IS NULL
        OR ccl.campaign_id = p_campaign_id
      )
  ),
  scoped_responses AS (
    SELECT
      fr.id,
      fr.link_id,
      fr.overall_satisfaction,
      fr.service_quality,
      fr.answers,
      fr.created_at,
      sl.company_id,
      sl.company_name,
      sl.campaign_id,
      sl.campaign_name,
      sl.campaign_questions
    FROM public.feedback_responses fr
    JOIN scoped_links sl ON sl.id = fr.link_id
  ),
  response_completion AS (
    SELECT
      sr.id,
      sr.campaign_id,
      CASE
        WHEN COALESCE(jsonb_array_length(sr.campaign_questions), 0) = 0 THEN NULL
        ELSE (
          SELECT
            COUNT(*) FILTER (
              WHERE public.jsonb_has_answer_value(sr.answers -> (question.value ->> 'id'))
            )::NUMERIC
            / NULLIF(COUNT(*), 0)::NUMERIC
            * 100
          FROM jsonb_array_elements(COALESCE(sr.campaign_questions, '[]'::jsonb)) AS question(value)
        )
      END AS completion_pct
    FROM scoped_responses sr
  ),
  analytics AS (
    SELECT
      COUNT(sr.id)::BIGINT AS total_responses,
      COALESCE((SELECT SUM(sl.access_count)::BIGINT FROM scoped_links sl), 0) AS views_in_scope,
      COALESCE(AVG(sr.overall_satisfaction)::NUMERIC, 0) AS avg_overall,
      COALESCE(AVG(sr.service_quality)::NUMERIC, 0) AS avg_service,
      COALESCE(AVG(rc.completion_pct)::NUMERIC, 0) AS avg_completion
    FROM scoped_responses sr
    LEFT JOIN response_completion rc ON rc.id = sr.id
  ),
  campaign_views AS (
    SELECT
      sl.campaign_id,
      MAX(sl.campaign_name) AS campaign_name,
      MAX(sl.company_name) AS company_name,
      SUM(sl.access_count)::BIGINT AS views
    FROM scoped_links sl
    GROUP BY sl.campaign_id
  ),
  campaign_counts AS (
    SELECT
      sr.campaign_id,
      COUNT(sr.id)::BIGINT AS responses
    FROM scoped_responses sr
    GROUP BY sr.campaign_id
  ),
  campaign_completion AS (
    SELECT
      rc.campaign_id,
      COALESCE(AVG(rc.completion_pct)::NUMERIC, 0) AS completion_rate
    FROM response_completion rc
    GROUP BY rc.campaign_id
  ),
  campaign_summary AS (
    SELECT
      cv.campaign_id,
      cv.campaign_name,
      cv.company_name,
      COALESCE(cc.responses, 0) AS responses,
      COALESCE(cv.views, 0) AS views,
      CASE
        WHEN COALESCE(cv.views, 0) > 0
          THEN COALESCE(cc.responses, 0)::NUMERIC / cv.views::NUMERIC * 100
        ELSE 0
      END AS response_rate,
      COALESCE(ccomp.completion_rate, 0) AS completion_rate
    FROM campaign_views cv
    LEFT JOIN campaign_counts cc ON cc.campaign_id = cv.campaign_id
    LEFT JOIN campaign_completion ccomp ON ccomp.campaign_id = cv.campaign_id
  )
  SELECT jsonb_build_object(
    'analytics',
    jsonb_build_object(
      'totalResponses', analytics.total_responses,
      'viewsInScope', analytics.views_in_scope,
      'responseRate',
      CASE
        WHEN analytics.views_in_scope > 0
          THEN analytics.total_responses::NUMERIC / analytics.views_in_scope::NUMERIC * 100
        ELSE 0
      END,
      'avgOverall', analytics.avg_overall,
      'avgService', analytics.avg_service,
      'avgCompletion', analytics.avg_completion
    ),
    'campaigns',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'campaignId', cs.campaign_id,
            'campaignName', cs.campaign_name,
            'companyName', cs.company_name,
            'responses', cs.responses,
            'views', cs.views,
            'responseRate', cs.response_rate,
            'completionRate', cs.completion_rate
          )
          ORDER BY cs.responses DESC, cs.campaign_name
        )
        FROM campaign_summary cs
      ),
      '[]'::jsonb
    )
  )
  FROM analytics;
$$;

CREATE OR REPLACE FUNCTION public.get_feedback_question_infographics(
  p_campaign_id UUID,
  p_company_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH selected_campaign AS (
    SELECT
      camp.id,
      public.extract_campaign_questions(camp.questions) AS questions
    FROM public.campaigns camp
    WHERE camp.id = p_campaign_id
      AND public.can_view_campaign_responses(auth.uid(), camp.id)
  ),
  scoped_responses AS (
    SELECT
      fr.answers,
      ccl.company_id
    FROM public.feedback_responses fr
    JOIN public.company_campaign_links ccl ON ccl.id = fr.link_id
    WHERE ccl.campaign_id = p_campaign_id
      AND (
        p_company_id IS NULL
        OR (
          ccl.company_id = p_company_id
          AND public.has_company_access(auth.uid(), p_company_id)
        )
      )
      AND public.can_view_campaign_responses(auth.uid(), ccl.campaign_id)
  ),
  questions AS (
    SELECT
      question.value AS question,
      question.value ->> 'id' AS question_id,
      question.value ->> 'question' AS question_label,
      question.value ->> 'type' AS question_type,
      question.ordinality
    FROM selected_campaign sc
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(sc.questions, '[]'::jsonb))
      WITH ORDINALITY AS question(value, ordinality)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', q.question_id,
        'question', q.question_label,
        'type', q.question_type,
        'chartData',
        COALESCE(
          (
            WITH distribution AS (
              SELECT
                label,
                COUNT(*)::INT AS value
              FROM (
                SELECT btrim(choice.value) AS label
                FROM scoped_responses sr
                CROSS JOIN LATERAL jsonb_array_elements_text(
                  CASE
                    WHEN q.question_type IN ('multiple_choice', 'rank')
                      AND jsonb_typeof(sr.answers -> q.question_id) = 'array'
                    THEN sr.answers -> q.question_id
                    ELSE '[]'::jsonb
                  END
                ) AS choice(value)

                UNION ALL

                SELECT btrim(choice.value) AS label
                FROM scoped_responses sr
                CROSS JOIN LATERAL jsonb_each(
                  CASE
                    WHEN q.question_type = 'checkbox_matrix'
                      AND jsonb_typeof(sr.answers -> q.question_id) = 'object'
                    THEN sr.answers -> q.question_id
                    ELSE '{}'::jsonb
                  END
                ) AS matrix(key, value)
                CROSS JOIN LATERAL jsonb_array_elements_text(
                  CASE
                    WHEN jsonb_typeof(matrix.value) = 'array'
                    THEN matrix.value
                    ELSE '[]'::jsonb
                  END
                ) AS choice(value)

                UNION ALL

                SELECT btrim(matrix.value) AS label
                FROM scoped_responses sr
                CROSS JOIN LATERAL jsonb_each_text(
                  CASE
                    WHEN q.question_type = 'radio_matrix'
                      AND jsonb_typeof(sr.answers -> q.question_id) = 'object'
                    THEN sr.answers -> q.question_id
                    ELSE '{}'::jsonb
                  END
                ) AS matrix(key, value)

                UNION ALL

                SELECT btrim(sr.answers ->> q.question_id) AS label
                FROM scoped_responses sr
                WHERE q.question_type IN ('single_choice', 'combobox')
                  AND public.jsonb_has_answer_value(sr.answers -> q.question_id)

                UNION ALL

                SELECT btrim(to_char(ROUND((sr.answers ->> q.question_id)::NUMERIC), 'FM999999999')) AS label
                FROM scoped_responses sr
                WHERE q.question_type IN ('rating', 'scale', 'nps')
                  AND public.jsonb_has_answer_value(sr.answers -> q.question_id)
                  AND (sr.answers ->> q.question_id) ~ '^-?[0-9]+(\.[0-9]+)?$'
              ) entries
              WHERE label IS NOT NULL
                AND label <> ''
              GROUP BY label
            )
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object('label', distribution.label, 'value', distribution.value)
                ORDER BY distribution.value DESC, distribution.label
              ),
              '[]'::jsonb
            )
            FROM distribution
          ),
          '[]'::jsonb
        )
      )
      ORDER BY q.ordinality
    ),
    '[]'::jsonb
  )
  FROM questions q;
$$;
