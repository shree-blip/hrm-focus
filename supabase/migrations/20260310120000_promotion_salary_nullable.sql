-- Make new_salary nullable in promotion_requests
-- Salary is no longer set by the line manager at request time;
-- VP/Admin enters it during the approval step.
alter table public.promotion_requests
  alter column new_salary drop not null;

-- Also make new_salary nullable in promotion_history for consistency
alter table public.promotion_history
  alter column new_salary drop not null;
