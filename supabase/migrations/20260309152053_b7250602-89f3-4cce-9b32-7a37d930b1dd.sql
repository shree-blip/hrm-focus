ALTER TABLE public.loan_requests
  DROP CONSTRAINT IF EXISTS loan_requests_term_months_check;

ALTER TABLE public.loan_requests
  ADD CONSTRAINT loan_requests_term_months_check
  CHECK (term_months >= 1 AND term_months <= 24);