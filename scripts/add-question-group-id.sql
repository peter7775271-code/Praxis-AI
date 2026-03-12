ALTER TABLE hsc_questions
ADD COLUMN IF NOT EXISTS group_id TEXT;

CREATE INDEX IF NOT EXISTS hsc_questions_group_id_idx
ON hsc_questions (group_id);