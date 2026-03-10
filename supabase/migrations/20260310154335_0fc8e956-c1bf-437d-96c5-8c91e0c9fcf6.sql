
ALTER TABLE public.leave_balances
  ALTER COLUMN used_days TYPE numeric(5,1) USING used_days::numeric(5,1),
  ALTER COLUMN total_days TYPE numeric(5,1) USING total_days::numeric(5,1);
