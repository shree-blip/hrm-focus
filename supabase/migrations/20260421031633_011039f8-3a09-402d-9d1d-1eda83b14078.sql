-- Backfill line_manager_id from legacy manager_id where missing
UPDATE public.employees
SET line_manager_id = manager_id
WHERE line_manager_id IS NULL
  AND manager_id IS NOT NULL;