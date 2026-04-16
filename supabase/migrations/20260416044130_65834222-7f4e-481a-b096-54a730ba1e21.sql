
CREATE OR REPLACE FUNCTION public.apply_attendance_edit(
  _attendance_log_id uuid,
  _clock_in timestamptz,
  _clock_out timestamptz,
  _break_start timestamptz,
  _break_end timestamptz,
  _total_break_minutes integer,
  _pause_start timestamptz,
  _pause_end timestamptz,
  _total_pause_minutes integer,
  _sessions_to_delete uuid[] DEFAULT '{}',
  _sessions_to_update jsonb DEFAULT '[]',
  _sessions_to_insert jsonb DEFAULT '[]'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session jsonb;
  v_log_user_id uuid;
BEGIN
  -- Get user_id from the attendance log for new session inserts
  SELECT user_id INTO v_log_user_id
  FROM public.attendance_logs
  WHERE id = _attendance_log_id;

  IF v_log_user_id IS NULL THEN
    RAISE EXCEPTION 'Attendance log not found: %', _attendance_log_id;
  END IF;

  -- 1) Delete removed sessions
  IF array_length(_sessions_to_delete, 1) > 0 THEN
    DELETE FROM public.attendance_break_sessions
    WHERE id = ANY(_sessions_to_delete)
      AND attendance_log_id = _attendance_log_id;
  END IF;

  -- 2) Update existing sessions
  FOR v_session IN SELECT * FROM jsonb_array_elements(_sessions_to_update)
  LOOP
    UPDATE public.attendance_break_sessions
    SET
      session_type = v_session->>'session_type',
      start_time = (v_session->>'start_time')::timestamptz,
      end_time = CASE WHEN v_session->>'end_time' IS NULL THEN NULL ELSE (v_session->>'end_time')::timestamptz END,
      duration_minutes = CASE WHEN v_session->>'duration_minutes' IS NULL THEN NULL ELSE (v_session->>'duration_minutes')::integer END
    WHERE id = (v_session->>'id')::uuid
      AND attendance_log_id = _attendance_log_id;
  END LOOP;

  -- 3) Insert new sessions
  FOR v_session IN SELECT * FROM jsonb_array_elements(_sessions_to_insert)
  LOOP
    INSERT INTO public.attendance_break_sessions (
      attendance_log_id, user_id, session_type, start_time, end_time, duration_minutes
    ) VALUES (
      _attendance_log_id,
      v_log_user_id,
      v_session->>'session_type',
      (v_session->>'start_time')::timestamptz,
      CASE WHEN v_session->>'end_time' IS NULL THEN NULL ELSE (v_session->>'end_time')::timestamptz END,
      CASE WHEN v_session->>'duration_minutes' IS NULL THEN NULL ELSE (v_session->>'duration_minutes')::integer END
    );
  END LOOP;

  -- 4) Update the parent attendance_logs row
  UPDATE public.attendance_logs
  SET
    clock_in = _clock_in,
    clock_out = _clock_out,
    break_start = _break_start,
    break_end = _break_end,
    total_break_minutes = _total_break_minutes,
    pause_start = _pause_start,
    pause_end = _pause_end,
    total_pause_minutes = _total_pause_minutes,
    is_edited = true
  WHERE id = _attendance_log_id;
END;
$$;
