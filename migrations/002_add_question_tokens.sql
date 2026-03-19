-- Add question tokens support for one-time purchases
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS question_tokens_balance INTEGER NOT NULL DEFAULT 0;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_question_tokens ON users(question_tokens_balance);
