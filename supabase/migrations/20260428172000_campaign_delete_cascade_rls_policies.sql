-- Ensure cascade deletes from campaigns to links/responses work under RLS

-- 1) Feedback responses: allow delete when user can delete campaigns/links/responses (not just responses)
DROP POLICY IF EXISTS "Section users can delete responses" ON public.feedback_responses;

CREATE POLICY "Section users can delete responses"
ON public.feedback_responses
FOR DELETE
TO authenticated
USING (
  public.has_permission(auth.uid(), 'responses')
  OR public.has_permission(auth.uid(), 'links')
  OR public.has_permission(auth.uid(), 'campaigns')
  OR public.has_permission(auth.uid(), 'overview')
);

-- 2) Company/Campaign links: allow delete when deleting campaigns
-- (keeps existing "links" policy, adds an additional path)
CREATE POLICY "Section users can delete links (via campaigns)"
ON public.company_campaign_links
FOR DELETE
TO authenticated
USING (
  public.has_permission(auth.uid(), 'campaigns')
  OR public.has_permission(auth.uid(), 'links')
  OR public.has_permission(auth.uid(), 'overview')
);
