/**
 * Return a relative time string like "5 minutes ago", "3 days ago".
 */
export function toRelativeTime(date) {
  if (!date) return "";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diff = (new Date(date) - Date.now()) / 1000; // seconds, negative = past

  const ranges = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [2592000, "day"],
    [31536000, "month"],
    [Infinity, "year"],
  ];
  let prev = 1;
  for (const [secs, unit] of ranges) {
    if (Math.abs(diff) < secs) {
      return rtf.format(Math.round(diff / prev), unit);
    }
    prev = secs;
  }
  return "";
}

/**
 * Format a date as YYYY-MM-DD (used for attendance records).
 */
export function formatAttendanceDate(date = new Date()) {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

/**
 * Return true if two Date objects represent the same calendar day.
 */
export function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * Check if a date string / Date is today.
 */
export function isToday(date) {
  return isSameDay(date, new Date());
}
