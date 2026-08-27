UPDATE public.leave_requests lr
SET rejection_reason = 'Cancelled: ' || COALESCE(NULLIF(TRIM(l.reason), ''), 'No reason provided')
FROM (
  SELECT DISTINCT ON (leave_request_id) leave_request_id, reason
  FROM public.leave_cancellation_logs
  ORDER BY leave_request_id, created_at DESC
) l
WHERE l.leave_request_id = lr.id
  AND lr.rejection_reason IS NULL
  AND lr.status IN ('rejected','cancelled');