-- Reduce repeated permission checks in response admin RPCs by computing the
-- readable campaign scope once per request, then joining within that scope.

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_company_created_by
  ON public.campaigns (tenant_id, company_id, created_by_user_id, id);

CREATE INDEX IF NOT EXISTS idx_company_campaign_links_campaign_company
  ON public.company_campaign_links (campaign_id, company_id);

CREATE OR REPLACE FUNCTION public.get_feedback_response_page(
  p_company_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  link_id UUID,
  overall_satisfaction INTEGER,
  service_quality INTEGER,
  recommendation_likelihood INTEGER,
  improvement_areas TEXT[],
  additional_comments TEXT,
  answers JSONB,
  created_at TIMESTAMPTZ,
  company_id UUID,
  company_name TEXT,
  company_logo_url TEXT,
  campaign_id UUID,
  campaign_name TEXT,
  campaign_type TEXT,
  campaign_questions JSONB,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH request_context AS (
    SELECT
      auth.uid() AS user_id,
      public.has_role(auth.uid(), 'super_admin') AS is_super_admin,
      public.has_role(auth.uid(), 'admin') AS is_admin,
      (
        public.has_permission(auth.uid(), 'overview')
        OR public.has_permission(auth.uid(), 'responses')
      ) AS has_response_access,
      public.get_user_tenant(auth.uid()) AS tenant_id,
      CASE
        WHEN p_company_id IS NULL THEN true
        ELSE public.has_company_access(auth.uid(), p_company_id)
      END AS company_scope_allowed
  ),
  scoped_campaigns AS (
    SELECT
      camp.id,
      camp.name,
      camp.campaign_type::text AS campaign_type,
      public.extract_campaign_questions(camp.questions) AS campaign_questions,
      comp.id AS company_id,
      comp.name AS company_name,
      comp.logo_url AS company_logo_url
    FROM public.campaigns camp
    JOIN public.companies comp ON comp.id = camp.company_id
    CROSS JOIN request_context ctx
    WHERE ctx.user_id IS NOT NULL
      AND ctx.company_scope_allowed
      AND (
        ctx.is_super_admin
        OR camp.created_by_user_id = ctx.user_id
        OR (
          ctx.is_admin
          AND ctx.has_response_access
          AND camp.tenant_id = ctx.tenant_id
        )
      )
      AND (p_company_id IS NULL OR camp.company_id = p_company_id)
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id)
  ),
  scoped_rows AS (
    SELECT
      fr.id,
      fr.link_id,
      fr.overall_satisfaction,
      fr.service_quality,
      fr.recommendation_likelihood,
      fr.improvement_areas,
      fr.additional_comments,
      fr.answers,
      fr.created_at,
      sc.company_id,
      sc.company_name,
      sc.company_logo_url,
      sc.id AS campaign_id,
      sc.name AS campaign_name,
      sc.campaign_type,
      sc.campaign_questions,
      COUNT(*) OVER () AS total_count
    FROM public.feedback_responses fr
    JOIN scoped_campaigns sc ON sc.id = fr.campaign_id
    ORDER BY fr.created_at DESC, fr.id DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500))
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  )
  SELECT * FROM scoped_rows;
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
  WITH request_context AS (
    SELECT
      auth.uid() AS user_id,
      public.has_role(auth.uid(), 'super_admin') AS is_super_admin,
      public.has_role(auth.uid(), 'admin') AS is_admin,
      (
        public.has_permission(auth.uid(), 'overview')
        OR public.has_permission(auth.uid(), 'responses')
      ) AS has_response_access,
      public.get_user_tenant(auth.uid()) AS tenant_id,
      CASE
        WHEN p_company_id IS NULL THEN true
        ELSE public.has_company_access(auth.uid(), p_company_id)
      END AS company_scope_allowed
  ),
  scoped_campaigns AS (
    SELECT
      camp.id AS campaign_id,
      camp.name AS campaign_name,
      comp.id AS company_id,
      comp.name AS company_name,
      public.extract_campaign_questions(camp.questions) AS campaign_questions
    FROM public.campaigns camp
    JOIN public.companies comp ON comp.id = camp.company_id
    CROSS JOIN request_context ctx
    WHERE ctx.user_id IS NOT NULL
      AND ctx.company_scope_allowed
      AND (
        ctx.is_super_admin
        OR camp.created_by_user_id = ctx.user_id
        OR (
          ctx.is_admin
          AND ctx.has_response_access
          AND camp.tenant_id = ctx.tenant_id
        )
      )
      AND (p_company_id IS NULL OR camp.company_id = p_company_id)
      AND (p_campaign_id IS NULL OR camp.id = p_campaign_id)
  ),
  scoped_links AS (
    SELECT
      ccl.id,
      ccl.company_id,
      ccl.campaign_id,
      ccl.access_count,
      sc.company_name,
      sc.campaign_name,
      sc.campaign_questions
    FROM public.company_campaign_links ccl
    JOIN scoped_campaigns sc ON sc.campaign_id = ccl.campaign_id
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
