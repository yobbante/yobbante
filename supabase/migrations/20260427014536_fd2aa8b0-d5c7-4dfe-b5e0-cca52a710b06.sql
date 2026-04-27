
CREATE OR REPLACE FUNCTION public.score_departure(
  s_origin_city text, s_origin_country text,
  s_dest_city text,   s_dest_country text,
  s_ready_date date,
  d_origin_city text, d_origin_country text,
  d_dest_city text,   d_dest_country text,
  d_departure_date date
) RETURNS TABLE(route_score numeric, date_score numeric, final_score numeric)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  rs numeric := 0;
  ds numeric := 0;
  diff int;
  same_origin_country boolean;
  same_dest_country boolean;
  same_origin_city boolean;
  same_dest_city boolean;
BEGIN
  same_origin_country := upper(coalesce(d_origin_country,'')) = upper(coalesce(s_origin_country,''));
  same_dest_country   := upper(coalesce(d_dest_country,''))   = upper(coalesce(s_dest_country,''));
  same_origin_city    := lower(coalesce(d_origin_city,''))    = lower(coalesce(s_origin_city,''));
  same_dest_city      := lower(coalesce(d_dest_city,''))      = lower(coalesce(s_dest_city,''));

  -- Hard constraint: same origin country AND same destination country, otherwise no match
  IF NOT (same_origin_country AND same_dest_country) THEN
    route_score := 0; date_score := 0; final_score := 0;
    RETURN NEXT; RETURN;
  END IF;

  IF same_origin_city AND same_dest_city THEN
    rs := 1.0;
  ELSIF same_dest_city THEN
    rs := 0.85;
  ELSIF same_origin_city THEN
    rs := 0.8;
  ELSE
    rs := 0.7;
  END IF;

  diff := GREATEST(0, (d_departure_date - coalesce(s_ready_date, current_date)));
  ds := 1.0 / (1 + diff);

  route_score := rs;
  date_score := ds;
  final_score := (rs * 0.6) + (ds * 0.4);
  RETURN NEXT;
END;
$$;
