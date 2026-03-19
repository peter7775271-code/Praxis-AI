-- Migration: Restrict Standard plan to a selected senior year level (Year 11 or Year 12)
-- Run this in your Supabase / Neon SQL editor

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS standard_year_level TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_standard_year_level_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_standard_year_level_check
      CHECK (standard_year_level IS NULL OR standard_year_level IN ('Year 11', 'Year 12'));
  END IF;
END $$;
