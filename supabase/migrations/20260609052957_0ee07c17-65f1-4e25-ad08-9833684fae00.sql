ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS screenshot_urls text[] NOT NULL DEFAULT '{}';

UPDATE public.bug_reports
SET screenshot_urls = ARRAY[screenshot_url]
WHERE screenshot_url IS NOT NULL
  AND (screenshot_urls IS NULL OR array_length(screenshot_urls, 1) IS NULL);