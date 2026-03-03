-- Drop redundant/broken triggers that conflict with the working set_loan_routing
DROP TRIGGER IF EXISTS trg_fill_org_vp ON public.loan_requests;
DROP TRIGGER IF EXISTS trg_set_vp_on_loan_insert ON public.loan_requests;

-- Drop their functions too
DROP FUNCTION IF EXISTS public.loan_requests_fill_org_and_vp();
DROP FUNCTION IF EXISTS public.set_vp_on_loan_insert();
