-- Enable realtime for feedback_responses table so dashboard can auto-update
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_responses;