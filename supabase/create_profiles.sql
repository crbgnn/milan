-- Create profiles table to store user country and basic info
-- Run this in your Supabase SQL editor or migration tool

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY,
  email text,
  full_name text,
  country text,
  created_at timestamp with time zone DEFAULT now()
);

-- Optional index for country aggregation
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);
