-- Row Level Security policies for public.profiles
-- NOTE: RLS is assumed to be already enabled on the table. Do NOT enable it here.

-- 1) Authenticated users: allow operations only on their own row

-- Allow authenticated users to INSERT but only when user_id equals auth.uid()
CREATE POLICY IF NOT EXISTS profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to SELECT only their own row
CREATE POLICY IF NOT EXISTS profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow authenticated users to UPDATE only their own row
CREATE POLICY IF NOT EXISTS profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2) Public access: allow limited SELECT for aggregation purposes only
-- IMPORTANT: RLS policies control row-level visibility, not column-level.
-- To avoid exposing sensitive fields beyond country aggregation, prefer
-- creating a dedicated view or RPC that returns only aggregated country totals
-- with a SECURITY DEFINER or service role. The policy below permits anonymous
-- SELECT on rows that have a non-null country value, which supports
-- aggregation by country, but does not prevent column-level exposure.

CREATE POLICY IF NOT EXISTS profiles_select_public_countries
  ON public.profiles
  FOR SELECT
  TO anon
  USING (country IS NOT NULL);

-- End of policies
