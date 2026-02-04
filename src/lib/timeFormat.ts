/**
 * Utility functions for consistent time formatting across the app
 */

/**
 * Convert 24-hour time string (HH:mm) to 12-hour format (h:mm AM/PM)
 * @param time24 - Time in 24-hour format (e.g., "14:30")
 * @returns Time in 12-hour format (e.g., "2:30 PM")
 */
export function formatTime12h(time24: string | null | undefined): string {
  if (!time24) return "";
  
  const [hours, minutes] = time24.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time24;
  
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Get current time as HH:mm (24-hour format for input compatibility)
 */
export function getCurrentTime24h(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * Format total minutes to human readable duration
 * @param totalMinutes - Total duration in minutes
 * @returns Formatted string (e.g., "2h 30m", "45m", "3h")
 */
export function formatDuration(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return "0m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
