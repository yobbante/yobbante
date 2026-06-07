
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS konnekt_link_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS konnekt_user_id text;

-- Backfill unique 4-digit references for NULL rows
WITH used AS (
  SELECT (reference)::int AS r FROM public.transporteurs
   WHERE reference ~ '^[0-9]{4}$'
),
pool AS (
  SELECT lpad(g::text, 4, '0') AS ref,
         row_number() OVER (ORDER BY random()) AS rn
    FROM generate_series(1, 9999) g
   WHERE g NOT IN (SELECT r FROM used)
),
to_assign AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
    FROM public.transporteurs
   WHERE reference IS NULL OR reference !~ '^[0-9]{4}$'
)
UPDATE public.transporteurs t
   SET reference = p.ref
  FROM to_assign a
  JOIN pool p ON p.rn = a.rn
 WHERE t.id = a.id;
