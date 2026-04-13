-- Fix orphaned auth users who have no profile record
-- This handles users who signed up (e.g. via Google OAuth) before the trigger was working correctly

-- Insert missing profiles for auth users who have a matching employee record
INSERT INTO public.profiles (user_id, first_name, last_name, email, job_title, department, location, phone)
SELECT 
  au.id,
  e.first_name,
  e.last_name,
  au.email,
  e.job_title,
  e.department,
  e.location,
  e.phone
FROM auth.users au
JOIN public.employees e ON lower(e.email) = lower(au.email)
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.id IS NULL;

-- Link employee profile_id for any unlinked employees
UPDATE public.employees e
SET profile_id = p.id
FROM public.profiles p
WHERE lower(p.email) = lower(e.email)
  AND e.profile_id IS NULL
  AND p.id IS NOT NULL;

-- Ensure all auth users have a default role
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'employee'
FROM auth.users au
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
WHERE ur.id IS NULL;

-- Mark allowed_signups as used for users who already registered
UPDATE public.allowed_signups a
SET is_used = true, used_at = COALESCE(a.used_at, now())
FROM auth.users au
WHERE lower(a.email) = lower(au.email)
  AND (a.is_used = false OR a.is_used IS NULL);