/**
 * Shared timezone utility for converting UTC timestamps to employee-local display.
 * Every log table, report, and display component must import from this file.
 * No component does its own timezone conversion.
 */

export function formatAttendanceTime(
  utc_timestamp: string,
  employee_timezone: string
) {
  const dt = new Date(utc_timestamp);

  const localDate = dt.toLocaleDateString("en-CA", {
    timeZone: employee_timezone,
  });

  const localTime = dt.toLocaleTimeString("en-US", {
    timeZone: employee_timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const tzAbbr = dt
    .toLocaleTimeString("en-US", {
      timeZone: employee_timezone,
      timeZoneName: "short",
    })
    .split(" ")
    .pop() || employee_timezone;

  return { localDate, localTime, tzAbbr, utc: utc_timestamp };
}

export function getWorkDate(
  clock_in_utc: string,
  employee_timezone: string
): string {
  return new Date(clock_in_utc).toLocaleDateString("en-CA", {
    timeZone: employee_timezone,
  });
}

/**
 * Get a human-readable work date display (e.g. "Mon, Mar 17")
 */
export function getWorkDateDisplay(
  clock_in_utc: string,
  employee_timezone: string
): string {
  return new Date(clock_in_utc).toLocaleDateString("en-US", {
    timeZone: employee_timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function calcHoursWorked(
  clock_in_utc: string,
  clock_out_utc: string
): string {
  const ms =
    new Date(clock_out_utc).getTime() - new Date(clock_in_utc).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/**
 * Check if a shift crosses midnight in the employee's timezone (night shift).
 */
export function isNightShift(
  clock_in_utc: string,
  clock_out_utc: string,
  employee_timezone: string
): boolean {
  const inDate = getWorkDate(clock_in_utc, employee_timezone);
  const outDate = getWorkDate(clock_out_utc, employee_timezone);
  return inDate !== outDate;
}

/**
 * Get current local time string for a given IANA timezone.
 * Used for live timezone display in management panel.
 */
export function getCurrentLocalTime(timezone: string): string {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

/**
 * Get timezone abbreviation for a given IANA timezone.
 */
export function getTimezoneAbbr(timezone: string): string {
  try {
    return (
      new Date()
        .toLocaleTimeString("en-US", {
          timeZone: timezone,
          timeZoneName: "short",
        })
        .split(" ")
        .pop() || timezone
    );
  } catch {
    return timezone;
  }
}

/**
 * Get UTC offset string for a given IANA timezone (e.g. "UTC+5:45").
 */
export function getUTCOffsetString(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value || timezone;
  } catch {
    return timezone;
  }
}

/** Default timezone used when employee has no explicit timezone set */
export const DEFAULT_TIMEZONE = "Asia/Kathmandu";
