
-- Drop the trigger on employees table
DROP TRIGGER IF EXISTS trg_auto_assign_line_manager_role ON public.employees;

-- Drop the trigger function
DROP FUNCTION IF EXISTS public.auto_assign_line_manager_role();
