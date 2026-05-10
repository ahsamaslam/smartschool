import { useEffect, useMemo, useState } from "react";

const API_ORIGIN_FOR_STATIC = (
  import.meta.env.VITE_API_URL || "http://localhost:8000/api"
).replace("/api", "");

export function coerceLectureMeta(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === "object" ? p : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

/** Canonical seconds from lecture_metadata when present (> 0). */
export function resolveRecordedDurationSeconds(meta) {
  const m = coerceLectureMeta(meta);
  if (!Object.keys(m).length) return null;
  const direct = Number(m.duration ?? m.durationSeconds ?? m.duration_seconds ?? m.length_seconds);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const markers = m.slideTimestamps ?? m.slide_markers ?? m.slide_timestamps;
  if (!Array.isArray(markers) || !markers.length) return null;
  let peak = 0;
  for (const row of markers) {
    const t = Number(row?.time);
    if (Number.isFinite(t) && t > peak) peak = t;
  }
  return peak > 0 ? peak : null;
}

export function formatLectureDuration(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "--";
  const total = Math.floor(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}

/**
 * Listed duration: persisted column → metadata → probing /static lecture file (fixes rows where meta.duration stayed 0).
 */
export default function RecordedLectureDurationCell({ lectureVideoUrl, lectureMetadata, lectureDurationSeconds }) {
  const meta = useMemo(() => coerceLectureMeta(lectureMetadata), [lectureMetadata]);

  const fromDb = useMemo(() => {
    const c = Number(lectureDurationSeconds);
    if (Number.isFinite(c) && c > 0) return c;
    return resolveRecordedDurationSeconds(meta);
  }, [lectureDurationSeconds, meta]);

  const absoluteUrl =
    lectureVideoUrl && typeof lectureVideoUrl === "string" && lectureVideoUrl.startsWith("/")
      ? `${API_ORIGIN_FOR_STATIC}${lectureVideoUrl}`
      : "";

  const [probedSec, setProbedSec] = useState(null);

  useEffect(() => {
    if (fromDb != null || !absoluteUrl) {
      setProbedSec(null);
      return undefined;
    }
    let cancelled = false;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const clearTimer = window.setTimeout(() => {
      if (!cancelled) setProbedSec(-1);
    }, 12000);

    const onDone = () => {
      window.clearTimeout(clearTimer);
    };

    video.onloadedmetadata = () => {
      onDone();
      const d = Number(video.duration);
      if (
        cancelled ||
        !Number.isFinite(d) ||
        d <= 0 ||
        d === Number.POSITIVE_INFINITY ||
        Number.isNaN(d)
      )
        setProbedSec(-1);
      else setProbedSec(d);
    };
    video.onerror = () => {
      if (!cancelled) {
        onDone();
        setProbedSec(-1);
      }
    };
    video.src = absoluteUrl;

    return () => {
      cancelled = true;
      window.clearTimeout(clearTimer);
      video.removeAttribute("src");
      video.load();
    };
  }, [fromDb, absoluteUrl]);

  const seconds = fromDb ?? (typeof probedSec === "number" && probedSec > 0 ? probedSec : null);
  return <span className="tabular-nums">{formatLectureDuration(seconds)}</span>;
}
