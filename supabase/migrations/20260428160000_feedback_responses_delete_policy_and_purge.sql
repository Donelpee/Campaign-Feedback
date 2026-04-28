-- Allow section-permission users to DELETE feedback responses (required for ON DELETE CASCADE to work)
DROP POLICY IF EXISTS "Section users can delete responses" ON public.feedback_responses;

CREATE POLICY "Section users can delete responses"
ON public.feedback_responses
FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), 'responses')
);

-- Purge all responses while keeping company + campaign data intact
DELETE FROM public.feedback_responses;
