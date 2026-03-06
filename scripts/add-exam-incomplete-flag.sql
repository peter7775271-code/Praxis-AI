ALTER TABLE hsc_questions
ADD COLUMN IF NOT EXISTS exam_incomplete BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS hsc_questions_exam_incomplete_idx
ON hsc_questions (exam_incomplete);
