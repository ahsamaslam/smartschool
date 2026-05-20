import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowLeftIcon,
  PlayCircleIcon,
  PresentationChartBarIcon,
  ArrowsPointingOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import learningService from "../../services/learningService";
import { SlideRenderer } from "../../components/slides/SlideRenderer";
import { SLIDE_TEMPLATES, SLIDE_ANIMATIONS } from "../../data/slideTemplates";
import { PageSpinner } from "../../components/common/Spinner";
import { parseLibraryTopicSlidesJson } from "../../utils/libraryTopicSlides";
import { normalizeLibraryTopicId } from "../../utils/libraryNavigation";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(
  "/api",
  "",
);

/** Lecture paths are stored like `/static/lectures/...`; support absolute URLs too. */
function resolveMediaUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  const path = raw.trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE.replace(/\/$/, "");
  const seg = path.startsWith("/") ? path : `/${path}`;
  return `${base}${seg}`;
}

export default function StudentTopicLearn() {
  const { topicId: rawId } = useParams();
  const topicId = normalizeLibraryTopicId(rawId);
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState(null);
  const [savedProgress, setSavedProgress] = useState(null);
  const [liveVideoPct, setLiveVideoPct] = useState(0);
  const [livePosition, setLivePosition] = useState(0); // currentTime in seconds, for display when duration unknown
  const [slidesDone, setSlidesDone] = useState(false);
  const [nav, setNav] = useState({ previous_topic_id: null, next_topic_id: null });
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);
  const [slides, setSlides] = useState([]);
  const [template, setTemplate] = useState(SLIDE_TEMPLATES[0]);
  const [speed, setSpeed] = useState(1);
  const videoRef = useRef(null);
  const deckRef = useRef(null);
  const progressTimer = useRef(null);
  const resumedRef = useRef(false);
  const topicRef = useRef(null);

  const loadTopic = useCallback(async () => {
    if (!topicId) return;
    setLoading(true);
    resumedRef.current = false;
    try {
      const res = await learningService.getStudentTopic(topicId);
      const rowRaw = res.data?.data ?? res.data;
      const row =
        rowRaw && typeof rowRaw === "object" && !Array.isArray(rowRaw) ? rowRaw : null;
      if (!row?.id) throw new Error("Topic not found");
      topicRef.current = row;
      setTopic(row);
      const prog = res.data?.progress ?? null;
      setSavedProgress(prog);
      if (prog?.lecture_watch_percent) setLiveVideoPct(Number(prog.lecture_watch_percent));
      if (prog?.slides_completed) setSlidesDone(true);
      const deck = parseLibraryTopicSlidesJson(row.slides_json);
      setSlides(deck);
      if (row.slide_theme) {
        const found = SLIDE_TEMPLATES.find((t) => t.id === row.slide_theme);
        if (found) setTemplate(found);
      }
      await learningService.updateProgress({ topic_id: String(row.id) }).catch(() => {});

      const [navRes] = await Promise.all([
        learningService.getTopicNavigation(topicId).catch(() => ({ data: {} })),
      ]);
      const nd = navRes?.data || {};
      setNav({
        previous_topic_id: nd.previous_topic_id || null,
        next_topic_id: nd.next_topic_id || null,
      });
    } catch {
      toast.error("Could not load this topic.");
      navigate("/student/courses", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [topicId, navigate]);

  useEffect(() => {
    loadTopic();
  }, [loadTopic]);

  useEffect(() => {
    if (!videoRef.current || !topic?.id || resumedRef.current) return;
    const pos = savedProgress?.lecture_position_seconds;
    if (pos != null && Number(pos) > 0 && videoRef.current) {
      videoRef.current.currentTime = Number(pos);
      resumedRef.current = true;
    }
  }, [topic?.id, savedProgress]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = Number(speed || 1);
  }, [speed]);

  const lectureMeta = useMemo(() => {
    const raw = topic?.lecture_metadata_json;
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return typeof raw === "object" ? raw : null;
  }, [topic?.lecture_metadata_json]);

  const lectureUrl = resolveMediaUrl(topic?.lecture_video_url);
  const markers = Array.isArray(lectureMeta?.slideTimestamps)
    ? lectureMeta.slideTimestamps
    : [];

  useEffect(() => {
    if (!topic?.id || loading || !lectureUrl) return;
    if (location.hash !== "#lecture") return;
    const timer = window.setTimeout(() => {
      document.getElementById("student-topic-lecture")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [topic?.id, loading, location.hash, lectureUrl]);

  useEffect(() => {
    if (!topic?.id || loading || slides.length === 0) return;
    if (location.hash !== "#slides") return;
    const timer = window.setTimeout(() => {
      setSlideIdx(0);
      setSlidesOpen(true);
    }, 120);
    return () => clearTimeout(timer);
  }, [topic?.id, loading, slides.length, location.hash]);

  const lecturePct = Math.max(
    liveVideoPct,
    Math.min(100, Number(savedProgress?.lecture_watch_percent || 0)),
  );
  const slidesPct =
    slidesDone || (slides.length > 0 && savedProgress?.slides_completed)
      ? 100
      : slides.length > 0
        ? Math.min(
            100,
            (Number(savedProgress?.slides_viewed_count || 0) /
              Math.max(slides.length, 1)) *
              100,
          )
        : 0;

  const sendVideoProgress = useCallback(() => {
    const t = topicRef.current;
    if (!t?.id || !videoRef.current) return;
    const v = videoRef.current;

    // If the video has ended, mark as 100% regardless of duration metadata
    if (v.ended) {
      setLiveVideoPct(100);
      setSavedProgress((prev) => ({
        ...(prev || {}),
        lecture_watch_percent: 100,
        lecture_position_seconds: v.currentTime,
      }));
      learningService
        .updateProgress({
          topic_id: String(t.id),
          lecture_watch_percent: 100,
          lecture_position_seconds: v.currentTime,
        })
        .catch(() => {});
      return;
    }

    // Prefer real duration; fall back to seekable end (works for webm recordings)
    let dur =
      v.duration && isFinite(v.duration) && v.duration > 0
        ? v.duration
        : t.lecture_duration_seconds || 0;
    if (!dur && v.seekable && v.seekable.length > 0) {
      const se = v.seekable.end(v.seekable.length - 1);
      if (se && isFinite(se) && se > 0) dur = se;
    }

    if (!dur) {
      // Duration still unknown — save position so resume works
      learningService
        .updateProgress({
          topic_id: String(t.id),
          lecture_position_seconds: v.currentTime,
        })
        .catch(() => {});
      return;
    }

    const pct = Math.min(100, (v.currentTime / dur) * 100);
    setSavedProgress((prev) => ({
      ...(prev || {}),
      lecture_watch_percent: pct,
      lecture_position_seconds: v.currentTime,
    }));
    learningService
      .updateProgress({
        topic_id: String(t.id),
        lecture_watch_percent: pct,
        lecture_position_seconds: v.currentTime,
      })
      .catch((err) => {
        console.error("Failed to update progress:", err);
      });
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !topic?.id) return;
    const onTime = () => {
      const t = topicRef.current;
      // If ended, force 100% immediately
      if (v.ended) {
        setLiveVideoPct(100);
        setLivePosition(Math.floor(v.currentTime));
        if (progressTimer.current) clearTimeout(progressTimer.current);
        progressTimer.current = setTimeout(sendVideoProgress, 500);
        return;
      }
      let dur =
        v.duration && isFinite(v.duration) && v.duration > 0
          ? v.duration
          : t?.lecture_duration_seconds || 0;
      // Seekable end works for webm recordings that lack duration metadata
      if (!dur && v.seekable && v.seekable.length > 0) {
        const se = v.seekable.end(v.seekable.length - 1);
        if (se && isFinite(se) && se > 0) dur = se;
      }
      setLivePosition(Math.floor(v.currentTime));
      if (dur > 0) {
        const pct = Math.min(100, (v.currentTime / dur) * 100);
        setLiveVideoPct(pct);
      }
      if (progressTimer.current) clearTimeout(progressTimer.current);
      progressTimer.current = setTimeout(sendVideoProgress, 2000);
    };
    const onEnded = () => {
      const t = topicRef.current;
      if (!t?.id) return;
      setLiveVideoPct(100);
      setSavedProgress((prev) => ({
        ...(prev || {}),
        lecture_watch_percent: 100,
        lecture_position_seconds: v.currentTime,
      }));
      learningService
        .updateProgress({
          topic_id: String(t.id),
          lecture_watch_percent: 100,
          lecture_position_seconds: v.currentTime,
        })
        .then(() => toast.success("Lecture marked as completed!"))
        .catch(() => toast.error("Could not save progress — try 'Mark as Watched' below."));
    };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("pause", sendVideoProgress);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("pause", sendVideoProgress);
      v.removeEventListener("ended", onEnded);
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [topic?.id, sendVideoProgress]);

  const slide = slides[slideIdx];
  const anim = SLIDE_ANIMATIONS.find((a) => a.id === slide?.animation)?.css || "";

  const prevSlide = useCallback(() => setSlideIdx((p) => Math.max(0, p - 1)), []);
  const nextSlide = useCallback(
    () => setSlideIdx((p) => Math.min(slides.length - 1, p + 1)),
    [slides.length],
  );

  useEffect(() => {
    if (!slidesOpen) return undefined;
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") nextSlide();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prevSlide();
      if (e.key === "Escape") setSlidesOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slidesOpen, nextSlide, prevSlide]);

  const markSlidesDone = () => {
    if (!topic?.id) return;
    learningService
      .updateProgress({
        topic_id: String(topic.id),
        slides_completed: true,
        slides_viewed_count: slides.length,
        slides_total: slides.length,
      })
      .then(() => {
        setSavedProgress((prev) => ({
          ...(prev || {}),
          slides_completed: true,
          slides_viewed_count: slides.length,
          slides_total: slides.length,
        }));
        setSlidesDone(true);
      })
      .catch((err) => {
        console.error("Failed to mark slides done:", err);
        setSlidesDone(true);
      });
  };

  const markLectureWatched = () => {
    if (!topic?.id) return;
    learningService
      .updateProgress({
        topic_id: String(topic.id),
        lecture_watch_percent: 100,
        lecture_position_seconds: videoRef.current?.currentTime || 0,
      })
      .then(() => {
        setLiveVideoPct(100);
        setSavedProgress((prev) => ({ ...(prev || {}), lecture_watch_percent: 100 }));
        toast.success("Lecture marked as completed!");
      })
      .catch(() => toast.error("Failed to save progress. Please try again."));
  };

  if (loading) return <PageSpinner />;

  if (!topic) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <button
        type="button"
        onClick={() => navigate("/student/courses")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to My Courses
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{topic.title}</h1>
          <p className="text-sm text-gray-500">Learning materials for your section</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {nav.previous_topic_id && (
            <Link
              to={`/student/learn/topic/${nav.previous_topic_id}`}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Previous topic
            </Link>
          )}
          {nav.next_topic_id && (
            <Link
              to={`/student/learn/topic/${nav.next_topic_id}`}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Next topic
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {(slides.length > 0 || lectureUrl) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Your progress</p>
          {slides.length > 0 && (
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Slides</span>
                <span>{Math.round(slidesPct)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${slidesPct}%` }}
                />
              </div>
            </div>
          )}
          {lectureUrl && (() => {
            const knownDur = topic?.lecture_duration_seconds || 0;
            const durationUnknown = knownDur === 0 && lecturePct === 0 && livePosition > 0;
            const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
            return (
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Lecture</span>
                  <span>
                    {lecturePct >= 100
                      ? "Completed ✓"
                      : durationUnknown
                        ? `${fmt(livePosition)} watched`
                        : `${Math.round(lecturePct)}%`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  {durationUnknown ? (
                    <div className="h-full bg-emerald-400 animate-pulse w-full" />
                  ) : (
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${lecturePct}%` }}
                    />
                  )}
                </div>
                {durationUnknown && (
                  <p className="text-xs text-amber-600 mt-1">
                    Duration unavailable — watch to end to mark as completed
                  </p>
                )}
              </div>
            );
          })()}
          {savedProgress?.topic_completed && (
            <p className="text-xs font-medium text-emerald-700">Topic completed</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-8">
        {slides.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSlideIdx(0);
              setSlidesOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700"
          >
            <PresentationChartBarIcon className="h-5 w-5" />
            View slides
          </button>
        )}
        {lectureUrl && (
          <button
            type="button"
            onClick={() =>
              document.getElementById("student-topic-lecture")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700"
          >
            <PlayCircleIcon className="h-5 w-5" />
            Watch recorded lecture
          </button>
        )}
      </div>

      {slides.length === 0 && !lectureUrl && (
        <p className="text-sm text-gray-500 border rounded-xl p-6 bg-gray-50">
          No slides or lecture uploaded for this topic yet.
        </p>
      )}

      {lectureUrl && (
        <div
          id="student-topic-lecture"
          className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white p-5 mb-8 scroll-mt-24"
        >
          <div className="flex items-center gap-2 mb-4">
            <PlayCircleIcon className="h-6 w-6 text-emerald-600 shrink-0" />
            <h2 className="text-lg font-bold text-gray-900">Recorded lecture</h2>
          </div>
          <video
            ref={videoRef}
            src={lectureUrl}
            controls
            playsInline
            className="w-full rounded-xl border border-gray-200 bg-black max-h-[70vh]"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-600">Playback speed</label>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
            <button
              type="button"
              onClick={() => videoRef.current?.requestFullscreen?.()}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
            >
              Fullscreen
            </button>
          </div>

          <p className="mt-3 text-sm">
            <Link
              to={`/student/topics/${topic.id}/lecture`}
              className="text-indigo-600 font-medium hover:underline"
            >
              Open lecture in full page →
            </Link>
          </p>

          {/* Mark as Watched — always visible so students can confirm regardless of auto-tracking */}
          <div className={`mt-4 flex items-center gap-3 p-3 rounded-xl border ${
            lecturePct >= 100
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <span className={`text-sm flex-1 ${lecturePct >= 100 ? "text-emerald-800" : "text-amber-800"}`}>
              {lecturePct >= 100
                ? "Lecture marked as completed."
                : livePosition > 0
                  ? `You've watched ${Math.floor(livePosition / 60)}m ${livePosition % 60}s. Finished watching?`
                  : "Watched the full lecture? Mark it as completed."}
            </span>
            <button
              type="button"
              onClick={markLectureWatched}
              className={`shrink-0 px-4 py-1.5 rounded-lg text-white text-sm font-semibold ${
                lecturePct >= 100
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {lecturePct >= 100 ? "Re-submit" : "Mark as Watched"}
            </button>
          </div>

          {markers.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">Slide markers</p>
              <div className="flex flex-wrap gap-2">
                {markers.map((m, idx) => (
                  <button
                    key={`${m.slide}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (!videoRef.current) return;
                      videoRef.current.currentTime = Number(m.time || 0);
                      void videoRef.current.play().catch(() => {});
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                  >
                    Slide {m.slide} · {Math.floor(Number(m.time || 0))}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {slidesOpen &&
        slides.length > 0 &&
        createPortal(
          <div ref={deckRef} className="fixed inset-0 z-[10000] bg-black flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4 pt-14">
              <div className={`w-full max-w-5xl ${anim}`} style={{ aspectRatio: "16/9" }}>
                <SlideRenderer slide={slide} template={template} slideIndex={slideIdx} />
              </div>
            </div>
            <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3 pointer-events-none">
              <div className="pointer-events-auto max-w-xl">
                <p className="text-white font-semibold text-sm drop-shadow-md line-clamp-2">
                  {topic.title}
                </p>
                <p className="text-white/60 text-xs mt-1">Arrow keys · Esc exits</p>
              </div>
              <div className="pointer-events-auto flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    (deckRef.current || document.documentElement)?.requestFullscreen?.()
                  }
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-2 text-sm"
                >
                  <ArrowsPointingOutIcon className="h-4 w-4" />
                  Fullscreen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    markSlidesDone();
                    setSlidesOpen(false);
                  }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-2 text-sm"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Exit
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3 bg-black/80 border-t border-white/10 flex-shrink-0">
              <div className="text-white/50 text-xs w-24 truncate hidden sm:block" />
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={prevSlide}
                  disabled={slideIdx === 0}
                  className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </button>
                <span className="text-white/70 text-sm font-mono min-w-[4.5rem] text-center">
                  {slideIdx + 1} / {slides.length}
                </span>
                <button
                  type="button"
                  onClick={nextSlide}
                  disabled={slideIdx === slides.length - 1}
                  className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="text-white/40 text-xs w-24 text-right hidden sm:block" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
