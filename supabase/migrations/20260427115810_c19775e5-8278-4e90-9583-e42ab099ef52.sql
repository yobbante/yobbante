ALTER TABLE public.refund_requests
  ADD CONSTRAINT refund_requests_shipment_id_fkey
  FOREIGN KEY (shipment_id) REFERENCES public.shipments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_refund_requests_shipment_id ON public.refund_requests(shipment_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status);