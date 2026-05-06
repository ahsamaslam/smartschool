/**
 * Helpers for Curriculum Library topics that store slides in slides_json.
 */

function extractSlidesArray(parsed) {
  if (parsed == null) return [];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object") {
    if (Array.isArray(parsed.slides)) return parsed.slides;
    if (Array.isArray(parsed.deck)) return parsed.deck;
    if (Array.isArray(parsed.slideDeck)) return parsed.slideDeck;
  }
  return [];
}

/**
 * Normalize DB / API payloads: raw array, JSON string of array, or
 * `{ "slides": [ ... ] }` (Claude / admin save shape).
 */
export function parseLibraryTopicSlidesJson(slidesJson) {
  if (slidesJson == null || slidesJson === "") return [];
  try {
    let data = typeof slidesJson === "string" ? JSON.parse(slidesJson) : slidesJson;
    let slides = extractSlidesArray(data);
    if (!slides.length && typeof data === "string") {
      try {
        slides = extractSlidesArray(JSON.parse(data));
      } catch {
        /* ignore */
      }
    }
    return Array.isArray(slides) ? slides : [];
  } catch {
    return [];
  }
}

export function libraryTopicHasSlides(topic) {
  if (!topic) return false;
  const fromJson = parseLibraryTopicSlidesJson(topic.slides_json).length > 0;
  if (typeof topic.has_slides === "boolean") {
    return Boolean(topic.has_slides) || fromJson;
  }
  return fromJson;
}
