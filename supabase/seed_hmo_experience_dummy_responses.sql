DO $$
DECLARE
  i INTEGER;
  v_provider_other TEXT;
  v_complaint_other TEXT;
  v_comment TEXT;
  v_hospital_name TEXT;
  v_hospital_score INTEGER;
  v_hmo_score INTEGER;
  v_overall_score INTEGER;
  v_service_quality INTEGER;
  v_recommendation INTEGER;
  v_improvement_areas TEXT[];
  v_provider_choices JSONB;
  v_contact_channels JSONB;
  v_complaint_channels JSONB;
  age_options TEXT[] := ARRAY['Less than 30', '30-39', '40-49', 'Above 50'];
  gender_options TEXT[] := ARRAY['Female', 'Male'];
  marital_options TEXT[] := ARRAY['Single', 'Married'];
  hospital_names TEXT[] := ARRAY[
    'Avon Medical Centre',
    'Cedarview Specialist Hospital',
    'Lakeside Family Clinic',
    'Pinecrest Diagnostics',
    'Starlight Medical Centre',
    'Harmony Care Hospital',
    'Primewell Health Hub',
    'Lifebridge Hospital',
    'Summit Care Clinic',
    'Greenfield Medical Centre'
  ];
  provider_base_options TEXT[] := ARRAY[
    'Proximity to home',
    'Proximity to office',
    'Recommendation of colleagues',
    'Directive from HR Manager/Company Policy'
  ];
  call_channel_options TEXT[] := ARRAY['Email', 'Telephone', 'Office Walk-In', 'WhatsApp'];
  complaint_channel_options TEXT[] := ARRAY[
    'People Management Department',
    'HMO Call Centre',
    'HMO Staff'
  ];
  improvement_area_options TEXT[] := ARRAY[
    'communication',
    'response_time',
    'customer_service',
    'technical_support',
    'product_quality',
    'documentation'
  ];
  waiting_labels TEXT[] := ARRAY['Very Poor', 'Poor', 'Fair', 'Good', 'Very Good'];
  call_labels TEXT[] := ARRAY['Very Poor ', 'Poor', 'Fair', 'Good', 'Very Good'];
  comment_templates TEXT[] := ARRAY[
    'The hospital environment was clean and the team handled my case with empathy.',
    'I would appreciate shorter waiting time and faster approvals for basic treatments.',
    'The provider staff were polite, but communication around medication could improve.',
    'The call centre resolved my issue eventually, although it took more follow-up than expected.',
    'My overall experience was positive and I would like more proactive health education updates.',
    'The claims and authorization process should be explained more clearly to employees.',
    'I had a smooth visit and the provider was easy to access from my office.',
    'The support experience improved after escalation and I would like that speed every time.',
    'The quality of care was strong, but front-desk coordination can be better organized.',
    'The HMO network is useful, though the complaint process still feels slower than expected.'
  ];
BEGIN
  FOR i IN 1..50 LOOP
    v_hospital_name := hospital_names[1 + floor(random() * array_length(hospital_names, 1))::INT];
    v_hospital_score := floor(random() * 6)::INT;
    v_hmo_score := floor(random() * 6)::INT;
    v_overall_score := LEAST(10, GREATEST(2, (v_hmo_score * 2) + floor(random() * 2)::INT));
    v_service_quality := LEAST(5, GREATEST(1, v_hospital_score + CASE WHEN random() < 0.45 THEN 0 ELSE 1 END));
    v_recommendation := LEAST(5, GREATEST(1, 1 + floor(random() * 5)::INT));

    v_improvement_areas := ARRAY(
      SELECT area
      FROM unnest(improvement_area_options) AS area
      ORDER BY random()
      LIMIT CASE WHEN random() < 0.55 THEN 1 ELSE 2 END
    );

    v_provider_other := CASE
      WHEN random() < 0.18
      THEN format('Specialist availability and family preference for visit %s', i)
      ELSE ''
    END;

    v_provider_choices := CASE
      WHEN v_provider_other <> ''
      THEN CASE
        WHEN random() < 0.5
        THEN jsonb_build_array('Other')
        ELSE jsonb_build_array(
          provider_base_options[1 + floor(random() * array_length(provider_base_options, 1))::INT],
          'Other'
        )
      END
      ELSE to_jsonb(ARRAY(
        SELECT choice
        FROM unnest(provider_base_options) AS choice
        ORDER BY random()
        LIMIT CASE WHEN random() < 0.4 THEN 2 ELSE 1 END
      ))
    END;

    v_contact_channels := to_jsonb(ARRAY(
      SELECT channel
      FROM unnest(call_channel_options) AS channel
      ORDER BY random()
      LIMIT CASE WHEN random() < 0.45 THEN 2 ELSE 1 END
    ));

    v_complaint_other := CASE
      WHEN random() < 0.14
      THEN format('Through a direct escalation mail thread %s', i)
      ELSE ''
    END;

    v_complaint_channels := CASE
      WHEN v_complaint_other <> ''
      THEN CASE
        WHEN random() < 0.5
        THEN jsonb_build_array('Other')
        ELSE jsonb_build_array(
          complaint_channel_options[1 + floor(random() * array_length(complaint_channel_options, 1))::INT],
          'Other'
        )
      END
      ELSE to_jsonb(ARRAY(
        SELECT channel
        FROM unnest(complaint_channel_options) AS channel
        ORDER BY random()
        LIMIT CASE WHEN random() < 0.35 THEN 2 ELSE 1 END
      ))
    END;

    v_comment := format(
      '%s %s %s',
      comment_templates[1 + floor(random() * array_length(comment_templates, 1))::INT],
      format('Provider used: %s.', v_hospital_name),
      format('Sample response #%s.', i)
    );

    PERFORM public.submit_feedback_response(
      'VchhLbfk',
      jsonb_build_object(
        'overall_satisfaction', v_overall_score,
        'service_quality', v_service_quality,
        'recommendation_likelihood', v_recommendation,
        'improvement_areas', to_jsonb(v_improvement_areas),
        'additional_comments', v_comment,
        'answers',
          jsonb_build_object(
            '327e4fae-814a-4edd-8901-77f5b2369658', age_options[1 + floor(random() * array_length(age_options, 1))::INT],
            'd46a9666-7510-4e26-b77f-0d5371c96bda', gender_options[1 + floor(random() * array_length(gender_options, 1))::INT],
            'fb4d9799-e469-441f-8b07-b6147845800b', marital_options[1 + floor(random() * array_length(marital_options, 1))::INT],
            '0e323e4b-5903-4fca-99b9-fa07d1f9cf7a', v_hospital_name,
            '080ad9ca-38d5-4c45-ac6d-8f89e1c109e0', v_provider_choices,
            '080ad9ca-38d5-4c45-ac6d-8f89e1c109e0__other', v_provider_other,
            '66e78bfa-7b67-4e63-a6d7-86f0d6f6fe2e', CASE WHEN random() < 0.88 THEN 'Yes' ELSE 'No' END,
            'f8417fb9-35ea-44c6-bbd3-3c76926208da', jsonb_build_object(
              'Waiting Time', jsonb_build_array(waiting_labels[1 + floor(random() * array_length(waiting_labels, 1))::INT]),
              'Friendliness and courtesy of hospital staff', jsonb_build_array(waiting_labels[1 + floor(random() * array_length(waiting_labels, 1))::INT]),
              'Communication/ interaction from the medical staff', jsonb_build_array(waiting_labels[1 + floor(random() * array_length(waiting_labels, 1))::INT]),
              'Explanation of prescribed drugs and their usage', jsonb_build_array(waiting_labels[1 + floor(random() * array_length(waiting_labels, 1))::INT]),
              'Quality of medical care', jsonb_build_array(waiting_labels[1 + floor(random() * array_length(waiting_labels, 1))::INT])
            ),
            'fe732a32-9a30-487e-a57e-68b94fecc77f', v_hospital_score,
            'cec22ce2-f519-437f-b486-4661146af972', CASE WHEN random() < 0.74 THEN 'Yes' ELSE 'No' END,
            '135c4571-e372-48e3-9eef-af6a1b776333', v_contact_channels,
            '85832bb0-bebd-4838-91a9-f353138b2b91', jsonb_build_object(
              'Ease of reaching the Call centre', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Timeliness of Response', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Friendliness and courteousness of Call agents', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Ability to resolve your complaints', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT]
            ),
            '8c201250-39dc-4856-bcbc-b2ad9d6e40f2', CASE WHEN random() < 0.52 THEN 'Yes' ELSE 'No' END,
            '7fa56f8a-56bc-4f7b-92dd-3452ebe42002', v_complaint_channels,
            '7fa56f8a-56bc-4f7b-92dd-3452ebe42002__other', v_complaint_other,
            'aa55aed9-d33d-46f6-a217-1ee6f91cce78', CASE WHEN random() < 0.71 THEN jsonb_build_array('Yes') ELSE jsonb_build_array('No') END,
            '4897ded7-b57f-4e70-aac3-db47b9223368', jsonb_build_object(
              'Enrolment process (registration,waiting period, etc)', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Quality of information provided at enrolment', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Accessibility of HMO staff (other than call centre)', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Friendliness and courteousness of HMO staff', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Provision of wellness and health promotion information', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Quality of health talks', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Quality of hospitals on Network', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT],
              'Accessibility of hospitals on network', call_labels[1 + floor(random() * array_length(call_labels, 1))::INT]
            ),
            '3fb87215-7aa4-48ac-ad3d-bee4668dd888', v_hmo_score,
            'd3582925-41b2-45ab-b5d6-9a59dd761b61', v_comment
          )
      )
    );
  END LOOP;
END $$;
