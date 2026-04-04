-- Run in Supabase SQL editor.
-- Changes matching North Sydney Girls 2022 Mathematics Extension 1 questions from Year 12 to Year 11.

-- Preview the rows that will be updated.
SELECT id, grade, year, subject, school_name, paper_number, question_number
FROM hsc_questions
WHERE grade = 'Year 12'
  AND year = 2022
  AND lower(subject) = lower('Mathematics Extension 1')
  AND lower(coalesce(school_name, '')) = lower('North Sydney Girls');

-- Perform the update.
UPDATE hsc_questions
SET grade = 'Year 11'
WHERE grade = 'Year 12'
  AND year = 2022
  AND lower(subject) = lower('Mathematics Extension 1')
  AND lower(coalesce(school_name, '')) = lower('North Sydney Girls');

-- Verify the result.
SELECT id, grade, year, subject, school_name, paper_number, question_number
FROM hsc_questions
WHERE grade = 'Year 11'
  AND year = 2022
  AND lower(subject) = lower('Mathematics Extension 1')
  AND lower(coalesce(school_name, '')) = lower('North Sydney Girls');