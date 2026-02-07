-- Allow anonymous users to insert feedback responses
CREATE POLICY "Anyone can submit feedback responses"
ON public.feedback_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (true);