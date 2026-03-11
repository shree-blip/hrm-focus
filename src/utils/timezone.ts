/**
 * Timezone utility functions for the HRM attendance system.
 * All timestamps are stored in UTC. These helpers convert for display.
 */

const NPT_OFFSET_MINUTES = 5 * 60 + 45; // UTC+5:45
const PST_OFFSET_MINUTES = -8 * 60;      // UTC-8

function applyOffset(utcDate: Date, offsetMinutes: number): Date {
  return new Date(utcDate.getTime() + offsetMinutes * 60 * 1000);
}

function formatTime12h(date: Date): string {
  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

function formatDateFull(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[date.getUTCDay()]}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * Convert a UTC ISO string to Nepal Time (UTC+5:45) formatted as readable string.
 * Returns e.g. "10:00 AM NPT"
 */
export function toNPT(utcDate: string): string {
  const date = new Date(utcDate);
  const npt = applyOffset(date, NPT_OFFSET_MINUTES);
  return `${formatTime12h(npt)} NPT`;
}

/**
 * Convert a UTC ISO string to PST (UTC-8) formatted as readable string.
 * Returns e.g. "4:15 PM PST"
 */
export function toPST(utcDate: string): string {
  const date = new Date(utcDate);
  const pst = applyOffset(date, PST_OFFSET_MINUTES);
  return `${formatTime12h(pst)} PST`;
}

/**
 * Returns dual-timezone display string.
 * e.g. "10:00 AM NPT / 11:15 PM PST"
 */
export function toDualTimezone(utcDate: string): string {
  return `${toNPT(utcDate)} / ${toPST(utcDate)}`;
}

/**
 * Extract the UTC date key (YYYY-MM-DD) from a UTC ISO string.
 * Use this instead of .split("T")[0] which uses the raw string without timezone consideration.
 */
export function getUTCDateKey(utcDate: string): string {
  const date = new Date(utcDate);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get NPT date key (YYYY-MM-DD) from a UTC ISO string.
 * Use for grouping attendance records by Nepal date.
 */
export function getNPTDateKey(utcDate: string): string {
  const date = new Date(utcDate);
  const npt = applyOffset(date, NPT_OFFSET_MINUTES);
  const y = npt.getUTCFullYear();
  const m = String(npt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(npt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get NPT date from a UTC ISO string for display (e.g. "Mon, Mar 11").
 */
export function getNPTDateDisplay(utcDate: string): string {
  const date = new Date(utcDate);
  const npt = applyOffset(date, NPT_OFFSET_MINUTES);
  return formatDateFull(npt);
}

/**
 * Build a UTC date range from year/month/day values (interpreted as UTC).
 * Ensures all date range filters sent to Supabase are in UTC ISO format.
 */
export function buildUTCDateRange(
  startYear: number, startMonth: number, startDay: number,
  endYear: number, endMonth: number, endDay: number
): { start: string; end: string } {
  const start = new Date(Date.UTC(startYear, startMonth, startDay, 0, 0, 0, 0));
  const end = new Date(Date.UTC(endYear, endMonth, endDay, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Get the current UTC time as an ISO string. 
 * Always use this (or new Date().toISOString()) when saving to the database.
 */
export function nowUTC(): string {
  return new Date().toISOString();
}
