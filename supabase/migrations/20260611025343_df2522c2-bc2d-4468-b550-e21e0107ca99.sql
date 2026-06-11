-- Fix leave balance instability:
-- The active trigger `recalc_leave_balances` fully recomputed used_days from
-- scratch on every leave_requests change. This overwrote manually-managed
-- static balances and ignored [Payroll]/[Paid Leave] payment options, causing
-- a user's remaining leave to drift unexpectedly.
--
-- Restore the intended incremental model where used_days is the static
-- authority and is only adjusted by the delta of each approval / cancellation
-- (auto_deduct_leave_balance), which correctly skips [Payroll] leaves.

DROP TRIGGER IF EXISTS trg_recalc_leave_balances ON public.leave_requests;

DROP TRIGGER IF EXISTS trg_auto_deduct_leave_balance ON public.leave_requests;

CREATE TRIGGER trg_auto_deduct_leave_balance
AFTER INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.auto_deduct_leave_balance();