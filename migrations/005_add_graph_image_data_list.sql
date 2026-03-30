-- Add support for multi-image questions by storing all image data URLs.
ALTER TABLE hsc_questions
ADD COLUMN IF NOT EXISTS graph_image_data_list TEXT[];

-- Backfill existing single-image rows into the new array column.
UPDATE hsc_questions
SET graph_image_data_list = ARRAY[graph_image_data]
WHERE graph_image_data IS NOT NULL
  AND (graph_image_data_list IS NULL OR array_length(graph_image_data_list, 1) IS NULL);

-- Optional helper index if you query based on whether a question has any images.
CREATE INDEX IF NOT EXISTS idx_hsc_questions_graph_image_data_list_not_null
ON hsc_questions ((graph_image_data_list IS NOT NULL));
