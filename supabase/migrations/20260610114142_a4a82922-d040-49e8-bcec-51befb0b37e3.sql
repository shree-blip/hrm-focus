CREATE OR REPLACE FUNCTION public.apply_attendance_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
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
  v_eff_in TIMESTAMPTZ;
  v_eff_out TIMESTAMPTZ;
  v_recalc_break INTEGER;
  v_recalc_pause INTEGER;
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

    -- ========== SYNC BREAK SESSIONS (explicit proposal) ==========
    IF NEW.proposed_break_minutes IS NOT NULL THEN
      SELECT count(*) INTO v_session_count
      FROM attendance_break_sessions
      WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'break';

      IF v_session_count = 0 THEN
        IF NEW.proposed_break_minutes > 0 THEN
          INSERT INTO attendance_break_sessions (
            attendance_log_id, user_id, session_type, start_time, end_time, duration_minutes
          ) VALUES (
            NEW.attendance_log_id, v_log_user_id, 'break',
            v_log.clock_in,
            v_log.clock_in + make_interval(mins => NEW.proposed_break_minutes),
            NEW.proposed_break_minutes
          );
        END IF;
      ELSIF v_session_count = 1 THEN
        UPDATE attendance_break_sessions
        SET end_time = start_time + make_interval(mins => NEW.proposed_break_minutes),
            duration_minutes = NEW.proposed_break_minutes
        WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'break';
      ELSE
        v_old_total := COALESCE(v_log.total_break_minutes, 0);
        IF v_old_total > 0 THEN
          FOR v_session IN
            SELECT id, duration_minutes, start_time FROM attendance_break_sessions
            WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'break' ORDER BY start_time
          LOOP
            v_ratio := COALESCE(v_session.duration_minutes, 0)::numeric / v_old_total;
            v_new_dur := round(v_ratio * NEW.proposed_break_minutes)::integer;
            UPDATE attendance_break_sessions
            SET duration_minutes = v_new_dur,
                end_time = v_session.start_time + make_interval(mins => v_new_dur)
            WHERE id = v_session.id;
          END LOOP;
        ELSE
          v_new_dur := round(NEW.proposed_break_minutes::numeric / v_session_count)::integer;
          UPDATE attendance_break_sessions
          SET duration_minutes = v_new_dur,
              end_time = start_time + make_interval(mins => v_new_dur)
          WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'break';
        END IF;
      END IF;
    END IF;

    -- ========== SYNC PAUSE SESSIONS (explicit proposal) ==========
    IF NEW.proposed_pause_minutes IS NOT NULL THEN
      SELECT count(*) INTO v_session_count
      FROM attendance_break_sessions
      WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'pause';

      IF v_session_count = 0 THEN
        IF NEW.proposed_pause_minutes > 0 THEN
          INSERT INTO attendance_break_sessions (
            attendance_log_id, user_id, session_type, start_time, end_time, duration_minutes
          ) VALUES (
            NEW.attendance_log_id, v_log_user_id, 'pause',
            v_log.clock_in,
            v_log.clock_in + make_interval(mins => NEW.proposed_pause_minutes),
            NEW.proposed_pause_minutes
          );
        END IF;
      ELSIF v_session_count = 1 THEN
        UPDATE attendance_break_sessions
        SET end_time = start_time + make_interval(mins => NEW.proposed_pause_minutes),
            duration_minutes = NEW.proposed_pause_minutes
        WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'pause';
      ELSE
        v_old_total := COALESCE(v_log.total_pause_minutes, 0);
        IF v_old_total > 0 THEN
          FOR v_session IN
            SELECT id, duration_minutes, start_time FROM attendance_break_sessions
            WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'pause' ORDER BY start_time
          LOOP
            v_ratio := COALESCE(v_session.duration_minutes, 0)::numeric / v_old_total;
            v_new_dur := round(v_ratio * NEW.proposed_pause_minutes)::integer;
            UPDATE attendance_break_sessions
            SET duration_minutes = v_new_dur,
                end_time = v_session.start_time + make_interval(mins => v_new_dur)
            WHERE id = v_session.id;
          END LOOP;
        ELSE
          v_new_dur := round(NEW.proposed_pause_minutes::numeric / v_session_count)::integer;
          UPDATE attendance_break_sessions
          SET duration_minutes = v_new_dur,
              end_time = start_time + make_interval(mins => v_new_dur)
          WHERE attendance_log_id = NEW.attendance_log_id AND session_type = 'pause';
        END IF;
      END IF;
    END IF;

    -- ========== CLAMP STALE SESSIONS TO WORK WINDOW ==========
    -- When a clock-out (or clock-in) is adjusted but pause/break minutes were
    -- NOT explicitly proposed, any break/pause session that falls (partly or
    -- fully) outside the new [clock_in, clock_out] window must be re-clamped so
    -- it cannot subtract more time than was actually worked.
    IF NEW.proposed_clock_in IS NOT NULL OR NEW.proposed_clock_out IS NOT NULL THEN
      v_eff_in  := COALESCE(NEW.proposed_clock_in, v_log.clock_in);
      v_eff_out := COALESCE(NEW.proposed_clock_out, v_log.clock_out);

      IF v_eff_out IS NOT NULL THEN
        -- Re-clamp each session's duration/end_time to the overlap with the window
        UPDATE attendance_break_sessions s
        SET
          duration_minutes = GREATEST(0, round(EXTRACT(EPOCH FROM (
            LEAST(COALESCE(s.end_time, v_eff_out), v_eff_out)
            - GREATEST(s.start_time, v_eff_in)
          )) / 60.0))::integer,
          end_time = LEAST(COALESCE(s.end_time, v_eff_out), v_eff_out)
        WHERE s.attendance_log_id = NEW.attendance_log_id
          AND (s.start_time >= v_eff_out OR s.end_time <= v_eff_in
               OR s.end_time > v_eff_out OR s.start_time < v_eff_in);

        -- Recompute totals from the (now clamped) sessions, unless explicitly proposed
        SELECT
          COALESCE(SUM(duration_minutes) FILTER (WHERE session_type = 'break'), 0),
          COALESCE(SUM(duration_minutes) FILTER (WHERE session_type = 'pause'), 0)
        INTO v_recalc_break, v_recalc_pause
        FROM attendance_break_sessions
        WHERE attendance_log_id = NEW.attendance_log_id;

        UPDATE attendance_logs SET
          total_break_minutes = CASE WHEN NEW.proposed_break_minutes IS NOT NULL
                                     THEN total_break_minutes ELSE v_recalc_break END,
          total_pause_minutes = CASE WHEN NEW.proposed_pause_minutes IS NOT NULL
                                     THEN total_pause_minutes ELSE v_recalc_pause END,
          -- Clear dangling open break/pause markers that fall outside the window
          pause_start = CASE WHEN pause_start IS NOT NULL AND pause_start >= v_eff_out
                             THEN NULL ELSE pause_start END,
          pause_end   = CASE WHEN pause_start IS NOT NULL AND pause_start >= v_eff_out
                             THEN NULL ELSE pause_end END,
          break_start = CASE WHEN break_start IS NOT NULL AND break_start >= v_eff_out
                             THEN NULL ELSE break_start END,
          break_end   = CASE WHEN break_start IS NOT NULL AND break_start >= v_eff_out
                             THEN NULL ELSE break_end END
        WHERE id = NEW.attendance_log_id;
      END IF;
    END IF;

    -- Re-read final totals for accurate audit
    SELECT * INTO v_log FROM attendance_logs WHERE id = NEW.attendance_log_id;
    v_new_values := jsonb_build_object(
      'clock_in', v_log.clock_in,
      'clock_out', v_log.clock_out,
      'total_break_minutes', v_log.total_break_minutes,
      'total_pause_minutes', v_log.total_pause_minutes
    );

    INSERT INTO attendance_edit_logs (attendance_id, edited_by, old_values, new_values, reason)
    VALUES (NEW.attendance_log_id, NEW.reviewer_id, v_old_values, v_new_values, NEW.reason);
  END IF;

  RETURN NEW;
END;
$func$;