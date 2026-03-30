
-- Re-create the trigger that was missing
-- The function auto_deduct_leave_balance() already exists, just attach the trigger

DROP TRIGGER IF EXISTS trg_auto_deduct_leave_balance ON public.leave_requests;

CREATE TRIGGER trg_auto_deduct_leave_balance
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_deduct_leave_balance();

-- Also handle INSERT (for admin-assigned leaves that are inserted as 'approved')
DROP TRIGGER IF EXISTS trg_auto_deduct_leave_balance_insert ON public.leave_requests;

CREATE TRIGGER trg_auto_deduct_leave_balance_insert
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.auto_deduct_leave_balance();
