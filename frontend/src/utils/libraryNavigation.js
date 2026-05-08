/** Curriculum Library SPA paths & topic ids (UUID in URL params). */

const LIBRARY_TOPIC_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function normalizeLibraryTopicId(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s) return "";
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next.trim();
    } catch {
      break;
    }
  }
  s = s.trim();
  const m = s.match(LIBRARY_TOPIC_UUID_RE);
  if (m) return m[0].toLowerCase();
  return s;
}

export function resolveLibraryTopicIdFromRow(topicLike) {
  if (topicLike == null) return "";
  if (typeof topicLike === "object") {
    const raw =
      topicLike.id ??
      topicLike.topic_id ??
      topicLike.library_topic_id ??
      topicLike.libraryTopicId;
    if (raw === undefined || raw === null) return "";
    return normalizeLibraryTopicId(raw);
  }
  return normalizeLibraryTopicId(topicLike);
}

export function libraryTopicPresentPath(topicId) {
  const id = normalizeLibraryTopicId(topicId);
  if (!id) return "";
  // UUID path segment is unreserved; avoid encodeURIComponent (double-encoding edge cases).
  return `/admin/library/topics/${id}/present`;
}

/** Absolute URL for opening presenter in a new tab (SPA route on same origin). */
export function libraryTopicPresentAbsUrl(topicId) {
  if (typeof window === "undefined") return "";
  const path = libraryTopicPresentPath(topicId);
  if (!path) return "";
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${window.location.origin}${base}${path}`;
}

export function openLibraryTopicPresentInNewTab(topicId) {
  openLibraryTopicPresentNewTab(topicId);
}

/**
 * Open presenter in a new tab. Must be called synchronously from a click handler
 * (do not await before this — pop-up blockers will block the window).
 * @param {string} topicId — normalized library topic UUID
 * @param {{ onBlocked?: () => void }} [options]
 * @returns {boolean} true if a window was opened
 */
export function openLibraryTopicPresentNewTab(topicId, options = {}) {
  const url = libraryTopicPresentAbsUrl(topicId);
  if (!url) return false;
  const w = window.open(url, "_blank");
  if (!w) {
    options.onBlocked?.();
    return false;
  }
  try {
    w.focus();
  } catch {
    /* ignore */
  }
  return true;
}
