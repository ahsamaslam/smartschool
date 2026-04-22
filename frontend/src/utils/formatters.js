/**
 * Format a date string or Date object.
 * @param {string|Date} date
 * @param {Intl.DateTimeFormatOptions} [opts]
 * @returns {string}
 */
export function formatDate(
  date,
  opts = { year: "numeric", month: "short", day: "numeric" },
) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", opts).format(new Date(date));
}

/**
 * Format a Date as a full datetime string.
 */
export function formatDateTime(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Format seconds into mm:ss (e.g. 125 → "2:05").
 */
export function formatDuration(totalSeconds) {
  if (totalSeconds == null || isNaN(totalSeconds)) return "—";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Format a 0-100 number as "72%" etc.
 */
export function formatPercentage(value, decimals = 0) {
  if (value == null || isNaN(value)) return "—";
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Return "Today", "Yesterday", or a short date string.
 */
export function formatSmartDate(date) {
  if (!date) return "—";
  const d = new Date(date);
  const today = new Date();
  const diff = Math.floor((today - d) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDate(date, { month: "short", day: "numeric" });
}
