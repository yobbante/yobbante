-- 1) Tighten permissive INSERT policies on public-facing forms.
-- Replace WITH CHECK (true) with minimal field validation so anon clients
-- can't spam the tables with empty rows.

-- manual_quote_requests
DROP POLICY IF EXISTS "Anyone can submit manual quote" ON public.manual_quote_requests;
CREATE POLICY "Anyone can submit manual quote"
ON public.manual_quote_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(client_name))  BETWEEN 2 AND 120
  AND length(btrim(client_phone)) BETWEEN 6 AND 32
  AND length(btrim(origin_city))  BETWEEN 2 AND 120
  AND length(btrim(destination_city)) BETWEEN 2 AND 120
  AND weight_kg > 0
  AND weight_kg < 10000
  -- authenticated users may only submit on behalf of themselves
  AND (auth.uid() IS NULL OR user_id IS NULL OR user_id = auth.uid())
);

-- enterprise_quotes
DROP POLICY IF EXISTS "Anyone can submit enterprise quote" ON public.enterprise_quotes;
CREATE POLICY "Anyone can submit enterprise quote"
ON public.enterprise_quotes
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(company))   BETWEEN 2 AND 200
  AND length(btrim(full_name)) BETWEEN 2 AND 120
  AND length(btrim(email))     BETWEEN 5 AND 200
  AND email LIKE '%_@_%.__%'
  AND length(btrim(phone))     BETWEEN 6 AND 32
  AND length(btrim(sector))    BETWEEN 2 AND 120
  AND length(btrim(volume))    BETWEEN 1 AND 120
);

-- 2) Lock down SECURITY DEFINER functions: revoke EXECUTE from PUBLIC / anon /
-- authenticated. RLS policies that reference these functions still work
-- because RLS evaluates with the policy owner's privileges, not the caller's.
-- Trigger functions are also unaffected.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid)                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_match_shipment(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rematch_waiting_shipments()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_auto_match_shipment()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_quote_v2(text, numeric, numeric, numeric, numeric, text, text, text)
  FROM PUBLIC, anon, authenticated;

-- service_role keeps full access (it bypasses these grants).
-- Re-grant calculate_quote_v2 to authenticated so the pricing engine still
-- works from the client when needed (used in legitimate quote flows).
GRANT EXECUTE ON FUNCTION public.calculate_quote_v2(text, numeric, numeric, numeric, numeric, text, text, text)
  TO authenticated;
