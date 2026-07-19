
ALTER TABLE public.dossiers 
  ADD COLUMN IF NOT EXISTS quote_amount_xof BIGINT,
  ADD COLUMN IF NOT EXISTS quote_currency TEXT,
  ADD COLUMN IF NOT EXISTS quote_valid_until DATE,
  ADD COLUMN IF NOT EXISTS quote_notes_admin TEXT,
  ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quote_response TEXT,
  ADD COLUMN IF NOT EXISTS quote_responded_at TIMESTAMPTZ;
