-- Migration: Add onboarding fields for signup/settings defaults
-- Run this in your Supabase / Neon SQL editor

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Defaults used by the "Exam Architect" preset on first load.
-- These should align with existing front-end defaults:
--   grade: Year 12
--   subject: Mathematics Advanced
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_grade TEXT NOT NULL DEFAULT 'Year 12',
  ADD COLUMN IF NOT EXISTS default_subject TEXT NOT NULL DEFAULT 'Mathematics Advanced';

