ALTER TABLE public.dossiers DROP CONSTRAINT IF EXISTS dossiers_payment_status_check;
ALTER TABLE public.dossiers ADD CONSTRAINT dossiers_payment_status_check
  CHECK (payment_status = ANY (ARRAY['not_required'::text,'pending'::text,'pending_delivery'::text,'paid'::text,'refunded'::text,'failed'::text]));