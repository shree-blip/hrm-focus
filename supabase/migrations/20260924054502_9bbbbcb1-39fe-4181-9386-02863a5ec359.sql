DELETE FROM public.calendar_events WHERE event_type='deadline' AND description='Books - Operational Calendar' AND title ILIKE 'Books Closing of previous%';

INSERT INTO public.calendar_events (title, description, event_date, event_type, created_by, org_id)
SELECT t.title, 'Books - Operational Calendar',
  CASE EXTRACT(ISODOW FROM d)::int WHEN 6 THEN d - 1 WHEN 7 THEN d - 2 ELSE d END,
  'deadline', '6bf66314-dc0f-4dda-945d-2b12972dbd84'::uuid, NULL
FROM generate_series(date '2026-10-01', date '2027-12-01', interval '1 month') m
CROSS JOIN LATERAL (VALUES ('Books Closing', 6), ('Books Review', 13)) t(title, off)
CROSS JOIN LATERAL (SELECT (m::date + t.off) AS d) x;