INSERT INTO public.calendar_events (title, description, event_date, event_type, created_by, org_id)
SELECT c, 'Client - Operational Calendar (bi-weekly)', d::date, 'deadline', '6bf66314-dc0f-4dda-945d-2b12972dbd84'::uuid, NULL
FROM unnest(ARRAY['Irving Health & Wellness Clinic','Fero Physician DBA Naperville Health & Wellness Clinic','ER of Lufkin','ER of White Rock','ER of Irving']) c
CROSS JOIN generate_series(date '2026-09-22', date '2027-12-31', interval '14 days') d;

INSERT INTO public.calendar_events (title, description, event_date, event_type, created_by, org_id)
SELECT t.title, t.descr,
  CASE EXTRACT(ISODOW FROM x.d)::int WHEN 6 THEN x.d - 1 WHEN 7 THEN x.d - 2 ELSE x.d END,
  'deadline', '6bf66314-dc0f-4dda-945d-2b12972dbd84'::uuid, NULL
FROM generate_series(date '2026-09-01', date '2027-12-01', interval '1 month') m
CROSS JOIN LATERAL (VALUES
  ('Venture 23 Inc', 'Client - Operational Calendar (month end)', (m + interval '1 month - 1 day')::date),
  ('Focus Physician Group PLLC', 'Client - Operational Calendar (8th of month)', m::date + 7)
) t(title, descr, d0)
CROSS JOIN LATERAL (SELECT t.d0 AS d) x
WHERE x.d >= date '2026-09-24';