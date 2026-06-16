-- RPC function returning aggregated pledge totals by country
-- Joins public.profiles with public.pledges, groups by country
-- Returns: country, total_amount, users_count
-- Only includes rows where profiles.country IS NOT NULL

CREATE OR REPLACE FUNCTION public.get_country_totals()
RETURNS TABLE(
  country text,
  total_amount numeric,
  users_count int
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    p.country::text AS country,
    SUM(COALESCE(pl.amount, 0))::numeric AS total_amount,
    COUNT(DISTINCT p.user_id)::int AS users_count
  FROM public.profiles p
  JOIN public.pledges pl
    ON pl.user_id = p.user_id
  WHERE p.country IS NOT NULL
  GROUP BY p.country
  ORDER BY total_amount DESC;
$$;

-- Grant execute to anon so frontend can call the RPC without exposing rows via RLS
GRANT EXECUTE ON FUNCTION public.get_country_totals() TO anon;
