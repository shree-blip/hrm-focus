
-- Fix security definer view warning
ALTER VIEW public.employee_salary_view SET (security_invoker = on);
