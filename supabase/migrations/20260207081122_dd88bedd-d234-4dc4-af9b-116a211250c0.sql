-- Drop the restrictive policy and the duplicate
DROP POLICY IF EXISTS "Anyone can insert responses" ON public.feedback_responses;
DROP POLICY IF EXISTS "Anyone can submit feedback responses" ON public.feedback_responses;

-- Create a proper permissive INSERT policy for anonymous feedback
CREATE POLICY "Anyone can submit feedback"
ON public.feedback_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (true);