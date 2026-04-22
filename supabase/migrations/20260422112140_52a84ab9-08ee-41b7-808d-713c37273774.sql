
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS konnekt_departure_id text,
  ADD COLUMN IF NOT EXISTS departure_date date,
  ADD COLUMN IF NOT EXISTS origin_city text,
  ADD COLUMN IF NOT EXISTS destination_city text,
  ADD COLUMN IF NOT EXISTS manual_request boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_assignment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_note text;

CREATE INDEX IF NOT EXISTS shipments_pending_assignment_idx
  ON public.shipments (pending_assignment) WHERE pending_assignment = true;
