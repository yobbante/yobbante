
-- Columns
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS dossiers_invoice_number_uniq
  ON public.dossiers(invoice_number) WHERE invoice_number IS NOT NULL;

-- Sequence + helper
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE n bigint := nextval('public.invoice_number_seq');
BEGIN
  RETURN 'FAC-' || EXTRACT(YEAR FROM now())::int || '-' || lpad((n % 10000)::text, 4, '0');
END;
$$;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff read invoices" ON storage.objects;
DROP POLICY IF EXISTS "Staff write invoices" ON storage.objects;
DROP POLICY IF EXISTS "Staff update invoices" ON storage.objects;

CREATE POLICY "Staff read invoices" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff write invoices" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update invoices" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND public.is_staff(auth.uid()));

-- Trigger that calls the generate-invoice edge function when payment_status flips to 'paid'
CREATE OR REPLACE FUNCTION public.trg_dossier_generate_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/generate-invoice';
BEGIN
  IF NEW.payment_status = 'paid'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.invoice_url IS NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('dossier_id', NEW.id),
        timeout_milliseconds := 8000
      );
    EXCEPTION WHEN OTHERS THEN
      -- never block payment update on invoice failure
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dossiers_generate_invoice ON public.dossiers;
CREATE TRIGGER dossiers_generate_invoice
AFTER UPDATE OF payment_status ON public.dossiers
FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_generate_invoice();
