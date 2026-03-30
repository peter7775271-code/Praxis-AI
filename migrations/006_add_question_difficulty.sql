ALTER TABLE hsc_questions
ADD COLUMN IF NOT EXISTS difficulty TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hsc_questions_difficulty_check'
  ) THEN
    ALTER TABLE hsc_questions
    ADD CONSTRAINT hsc_questions_difficulty_check
    CHECK (
      difficulty IS NULL
      OR difficulty IN ('Foundation', 'Intermediate', 'Advanced', 'Extension')
    );
  END IF;
END $$;
