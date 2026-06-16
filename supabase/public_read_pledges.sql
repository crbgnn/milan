-- Enable anonymous public read access for pledge stats.
-- Apply this script in the Supabase SQL editor or via psql.

-- If your project uses RLS on public.pledges, allow anon SELECT.
CREATE POLICY "Public read pledges"
ON public.pledges
FOR SELECT
TO anon
USING (true);

-- Also grant the table-level privilege so anon can perform SELECT when RLS is not configured.
GRANT SELECT ON public.pledges TO anon;

-- Do NOT grant INSERT or any write privilege to anon.
-- Authenticated users should continue to insert pledges through the app.
