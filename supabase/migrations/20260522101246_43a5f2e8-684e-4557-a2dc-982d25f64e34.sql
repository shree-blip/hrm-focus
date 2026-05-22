UPDATE public.notification_logs
SET status = 'skipped',
    next_retry_at = NULL,
    error_message = COALESCE(error_message, '') || ' | auto-skipped: non-leave event not supported by retry job',
    updated_at = now()
WHERE status = 'pending'
  AND event_type NOT IN ('submitted','approved','rejected','cancelled','admin_assigned');