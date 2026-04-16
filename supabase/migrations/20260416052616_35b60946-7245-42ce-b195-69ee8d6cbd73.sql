
CREATE OR REPLACE FUNCTION public.apply_attendance_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_log RECORD;
  v_session RECORD;
  v_session_count INTEGER;
  v_old_total NUMERIC;
  v_ratio NUMERIC;
  v_new_dur INTEGER;
  v_log_user_id UUID;
BEGIN
  -- Only act when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    -- Fetch current log values for audit
    SELECT * INTO v_log FROM attendance_logs WHERE id = NEW.attendance_log_id;
    v_log_user_id := v_log.user_id;

    v_old_values := jsonb_build_object(
      'clock_in', v_log.clock_in,
      'clock_out', v_log.clock_out,
      'total_break_minutes', v_log.total_break_minutes,
      'total_pause_minutes', v_log.total_pause_minutes
    );

    -- Apply proposed values to attendance_logs
    UPDATE attendance_logs SET
      clock_in = COALESCE(NEW.proposed_clock_in, clock_in),
      clock_out = COALESCE(NEW.proposed_clock_out, clock_out),
      total_break_minutes = COALESCE(NEW.proposed_break_minutes, total_break_minutes),
      total_pause_minutes = COALESCE(NEW.proposed_pause_minutes, total_pause_minutes),
      is_edited = true,
      status = CASE
        WHEN COALESCE(NEW.proposed_clock_out, v_log.clock_out) IS NOT NULL THEN 'completed'
        ELSE status
      END
    WHERE id = NEW.attendance_log_id;

    -- ========== SYNC BREAK SESSIONS ==========
    IF NEW.proposed_break_minutes IS NOT NULL THEN
      SELECT count(*) INTO v_session_count
      FROM attendance_break_sessions
      WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'break';

      IF v_session_count = 0 THEN
        -- No existing break session → INSERT one
        IF NEW.proposed_break_minutes > 0 THEN
          INSERT INTO attendance_break_sessions (
            attendance_log_id, user_id, session_type, start_time, end_time, duration_minutes
          ) VALUES (
            NEW.attendance_log_id,
            v_log_user_id,
            'break',
            v_log.clock_in,
            v_log.clock_in + make_interval(mins => NEW.proposed_break_minutes),
            NEW.proposed_break_minutes
          );
        END IF;
      ELSIF v_session_count = 1 THEN
        -- Single break session → UPDATE it directly
        UPDATE attendance_break_sessions
        SET
          end_time = start_time + make_interval(mins => NEW.proposed_break_minutes),
          duration_minutes = NEW.proposed_break_minutes
        WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'break';
      ELSE
        -- Multiple break sessions → distribute proportionally
        v_old_total := COALESCE(v_log.total_break_minutes, 0);
        IF v_old_total > 0 THEN
          FOR v_session IN
            SELECT id, duration_minutes, start_time
            FROM attendance_break_sessions
            WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'break'
            ORDER BY start_time
          LOOP
            v_ratio := COALESCE(v_session.duration_minutes, 0)::numeric / v_old_total;
            v_new_dur := round(v_ratio * NEW.proposed_break_minutes)::integer;
            UPDATE attendance_break_sessions
            SET
              duration_minutes = v_new_dur,
              end_time = v_session.start_time + make_interval(mins => v_new_dur)
            WHERE id = v_session.id;
          END LOOP;
        ELSE
          -- Old total was 0 but multiple sessions exist: set all to equal share
          v_new_dur := round(NEW.proposed_break_minutes::numeric / v_session_count)::integer;
          UPDATE attendance_break_sessions
          SET
            duration_minutes = v_new_dur,
            end_time = start_time + make_interval(mins => v_new_dur)
          WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'break';
        END IF;
      END IF;
    END IF;

    -- ========== SYNC PAUSE SESSIONS ==========
    IF NEW.proposed_pause_minutes IS NOT NULL THEN
      SELECT count(*) INTO v_session_count
      FROM attendance_break_sessions
      WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'pause';

      IF v_session_count = 0 THEN
        IF NEW.proposed_pause_minutes > 0 THEN
          INSERT INTO attendance_break_sessions (
            attendance_log_id, user_id, session_type, start_time, end_time, duration_minutes
          ) VALUES (
            NEW.attendance_log_id,
            v_log_user_id,
            'pause',
            v_log.clock_in,
            v_log.clock_in + make_interval(mins => NEW.proposed_pause_minutes),
            NEW.proposed_pause_minutes
          );
        END IF;
      ELSIF v_session_count = 1 THEN
        UPDATE attendance_break_sessions
        SET
          end_time = start_time + make_interval(mins => NEW.proposed_pause_minutes),
          duration_minutes = NEW.proposed_pause_minutes
        WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'pause';
      ELSE
        v_old_total := COALESCE(v_log.total_pause_minutes, 0);
        IF v_old_total > 0 THEN
          FOR v_session IN
            SELECT id, duration_minutes, start_time
            FROM attendance_break_sessions
            WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'pause'
            ORDER BY start_time
          LOOP
            v_ratio := COALESCE(v_session.duration_minutes, 0)::numeric / v_old_total;
            v_new_dur := round(v_ratio * NEW.proposed_pause_minutes)::integer;
            UPDATE attendance_break_sessions
            SET
              duration_minutes = v_new_dur,
              end_time = v_session.start_time + make_interval(mins => v_new_dur)
            WHERE id = v_session.id;
          END LOOP;
        ELSE
          v_new_dur := round(NEW.proposed_pause_minutes::numeric / v_session_count)::integer;
          UPDATE attendance_break_sessions
          SET
            duration_minutes = v_new_dur,
            end_time = start_time + make_interval(mins => v_new_dur)
          WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'pause';
        END IF;
      END IF;
    END IF;

    v_new_values := jsonb_build_object(
      'clock_in', COALESCE(NEW.proposed_clock_in, v_log.clock_in),
      'clock_out', COALESCE(NEW.proposed_clock_out, v_log.clock_out),
      'total_break_minutes', COALESCE(NEW.proposed_break_minutes, v_log.total_break_minutes),
      'total_pause_minutes', COALESCE(NEW.proposed_pause_minutes, v_log.total_pause_minutes)
    );

    -- Write audit log
    INSERT INTO attendance_edit_logs (attendance_id, edited_by, old_values, new_values, reason)
    VALUES (NEW.attendance_log_id, NEW.reviewer_id, v_old_values, v_new_values, NEW.reason);
  END IF;

  RETURN NEW;
END;
$$;
