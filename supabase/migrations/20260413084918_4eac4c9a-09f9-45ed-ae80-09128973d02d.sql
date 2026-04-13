-- One-time fix: link employees to profiles where emails match but profile_id is null
UPDATE public.employees e
SET profile_id = p.id, updated_at = now()
FROM public.profiles p
WHERE lower(e.email) = lower(p.email)
  AND e.profile_id IS NULL
  AND p.id IS NOT NULL;

-- Also mark allowed_signups as used for any email that has a profile (meaning user signed up)
UPDATE public.allowed_signups a
SET is_used = true, used_at = COALESCE(a.used_at, now())
FROM public.profiles p
WHERE lower(a.email) = lower(p.email)
  AND (a.is_used = false OR a.is_used IS NULL);