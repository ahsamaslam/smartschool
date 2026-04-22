import { SCORE_THRESHOLDS } from "./constants";

/**
 * Format a numeric score as a percentage string.
 * @param {number|null} score  0-100
 * @returns {string}
 */
export function formatScore(score) {
  if (score == null || isNaN(score)) return "—";
  return `${Math.round(score)}%`;
}

/**
 * Truncate a string to maxLen characters, appending '…'.
 */
export function truncate(str, maxLen = 60) {
  if (!str) return "";
  return str.length <= maxLen ? str : `${str.slice(0, maxLen)}…`;
}

/**
 * Get initials from a full name (up to 2 chars).
 */
export function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/**
 * Return Tailwind colour class based on score value.
 */
export function scoreColor(score) {
  if (score == null) return "text-gray-400";
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return "text-green-600";
  if (score >= SCORE_THRESHOLDS.GOOD) return "text-blue-600";
  if (score >= SCORE_THRESHOLDS.AVERAGE) return "text-yellow-600";
  return "text-red-600";
}

/**
 * Capitalise first letter of a string.
 */
export function capitalise(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Build a URL query string from an object, omitting null/undefined values.
 */
export function buildQuery(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return qs ? `?${qs}` : "";
}
