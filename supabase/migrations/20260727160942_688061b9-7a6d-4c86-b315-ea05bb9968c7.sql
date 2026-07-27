CREATE TABLE public.user_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid,
  recipient_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_messages TO authenticated;
GRANT ALL ON public.user_messages TO service_role;

ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage messages" ON public.user_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "users read own or broadcast" ON public.user_messages
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR recipient_id IS NULL);

CREATE POLICY "users mark own read" ON public.user_messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR recipient_id IS NULL)
  WITH CHECK (recipient_id = auth.uid() OR recipient_id IS NULL);

CREATE INDEX user_messages_recipient_idx ON public.user_messages(recipient_id, created_at DESC);