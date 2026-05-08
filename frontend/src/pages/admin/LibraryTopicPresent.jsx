import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { XMarkIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import libraryService from "../../services/libraryService";
import { SlideRenderer } from "../../components/slides/SlideRenderer";
import { SLIDE_TEMPLATES, SLIDE_ANIMATIONS } from "../../data/slideTemplates";
import { PageSpinner } from "../../components/common/Spinner";
import { parseLibraryTopicSlidesJson } from "../../utils/libraryTopicSlides";
import { normalizeLibraryTopicId } from "../../utils/libraryNavigation";

export default function LibraryTopicPresent() {
  const { topicId: topicIdParam } = useParams();
  const topicId = normalizeLibraryTopicId(topicIdParam);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState([]);
  const [template, setTemplate] = useState(SLIDE_TEMPLATES[0]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!topicId) {
        toast.error("Missing topic");
        setLoading(false);
        navigate("/admin/library", { replace: true });
        return;
      }
      setLoading(true);
      try {
        const res = await libraryService.getTopic(topicId, { timeout: 20000 });
        const rowRaw = res.data?.data ?? res.data;
        const row =
          rowRaw && typeof rowRaw === "object" && !Array.isArray(rowRaw) ? rowRaw : null;
        const rowPk = row
          ? row.id ?? row.topic_id ?? row.topicId ?? row.library_topic_id ?? row.ID
          : null;
        const rowPkStr =
          rowPk !== undefined && rowPk !== null && String(rowPk).trim() !== ""
            ? String(rowPk).trim()
            : "";
        if (cancel || !row || !rowPkStr) throw new Error("Topic not found");
        setTitle(row.title || "Slides");
        const deck = parseLibraryTopicSlidesJson(row.slides_json);
        if (!deck.length) {
          toast.error("No slides saved for this topic yet");
          navigate("/admin/library", { replace: true });
          return;
        }
        setSlides(deck);
        if (row.slide_theme) {
          const found = SLIDE_TEMPLATES.find((t) => t.id === row.slide_theme);
          if (found) setTemplate(found);
        }
      } catch (e) {
        const st = e?.response?.status;
        const detail = e?.response?.data?.detail;
        const timedOut = e?.code === "ECONNABORTED" || e?.message?.toLowerCase()?.includes("timeout");
        toast.error(
          (typeof detail === "string" && detail) ||
            (timedOut
              ? "Request timed out — is the API running on port 8000?"
              : null) ||
            (st === 401 || st === 403
              ? `Not authorized (${st}). Sign in again.`
              : e?.message || (st ? `Could not load topic (${st})` : "Could not load topic")),
        );
        navigate("/admin/library", { replace: true });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [topicId, navigate]);

  useEffect(() => {
    if (!title) return undefined;
    const prev = document.title;
    document.title = `${title} — Present`;
    return () => {
      document.title = prev;
    };
  }, [title]);

  const slide = slides[idx];
  const anim = SLIDE_ANIMATIONS.find((a) => a.id === slide?.animation)?.css || "";

  const prev = useCallback(() => setIdx((p) => Math.max(0, p - 1)), []);
  const next = useCallback(() => setIdx((p) => Math.min(slides.length - 1, p + 1)), [slides.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
      if (e.key === "Escape") navigate("/admin/library", { replace: true });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, navigate]);

  if (loading) {
    return <PageSpinner />;
  }

  if (!slides.length) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 pt-14">
        <div className={`w-full max-w-5xl ${anim}`} style={{ aspectRatio: "16/9" }}>
          <SlideRenderer slide={slide} template={template} slideIndex={idx} />
        </div>
      </div>
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto max-w-xl">
          <p className="text-white font-semibold text-sm drop-shadow-md line-clamp-2">{title}</p>
          <p className="text-white/60 text-xs mt-1">Arrow keys • Esc exits</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/library", { replace: true })}
          className="pointer-events-auto p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-2 text-sm"
        >
          <XMarkIcon className="h-4 w-4" />
          Exit
        </button>
      </div>
      <div className="flex items-center justify-between px-6 py-3 bg-black/80 border-t border-white/10 flex-shrink-0">
        <div className="text-white/50 text-xs w-24 truncate hidden sm:block" />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={prev}
            disabled={idx === 0}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronUpIcon className="h-4 w-4" />
          </button>
          <span className="text-white/70 text-sm font-mono min-w-[4.5rem] text-center">
            {idx + 1} / {slides.length}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={idx === slides.length - 1}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="text-white/40 text-xs w-24 text-right hidden sm:block">Library</div>
      </div>
    </div>,
    document.body,
  );
}
