/**
 * SlidePresenter — powerful animated slide creator & presenter.
 *
 * Props:
 *   slides       – array of slide objects (see SLIDE_TYPES below)
 *   theme        – theme id string (default "ocean")
 *   onSave       – async fn(slides, theme) called when user clicks Save
 *   readOnly     – boolean, show only preview (no editing)
 *   topicTitle   – string, used to auto-generate slides from content
 *   topicContent – string, raw text content to parse into slides
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  PlayIcon,
  XMarkIcon,
  CheckIcon,
  SwatchIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/react/24/outline";

// ── Themes ────────────────────────────────────────────────────────────────────
export const SLIDE_THEMES = {
  ocean: {
    name: "Ocean Depth",
    bg: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0891b2 100%)",
    accent: "#38bdf8",
    accentDark: "#0369a1",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.75)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(56,189,248,0.3)",
    bullet: "#38bdf8",
    pill: "rgba(56,189,248,0.15)",
  },
  forest: {
    name: "Emerald Forest",
    bg: "linear-gradient(135deg, #052e16 0%, #166534 55%, #15803d 100%)",
    accent: "#4ade80",
    accentDark: "#16a34a",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.75)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(74,222,128,0.3)",
    bullet: "#86efac",
    pill: "rgba(74,222,128,0.15)",
  },
  sunset: {
    name: "Golden Sunset",
    bg: "linear-gradient(135deg, #431407 0%, #c2410c 55%, #d97706 100%)",
    accent: "#fbbf24",
    accentDark: "#b45309",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.75)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(251,191,36,0.3)",
    bullet: "#fde68a",
    pill: "rgba(251,191,36,0.15)",
  },
  royal: {
    name: "Royal Purple",
    bg: "linear-gradient(135deg, #2e1065 0%, #6d28d9 55%, #c026d3 100%)",
    accent: "#e879f9",
    accentDark: "#a21caf",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.75)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(232,121,249,0.3)",
    bullet: "#f0abfc",
    pill: "rgba(232,121,249,0.15)",
  },
  midnight: {
    name: "Midnight",
    bg: "linear-gradient(135deg, #020617 0%, #1e1b4b 55%, #312e81 100%)",
    accent: "#818cf8",
    accentDark: "#4338ca",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.7)",
    card: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(129,140,248,0.25)",
    bullet: "#a5b4fc",
    pill: "rgba(129,140,248,0.12)",
  },
  rose: {
    name: "Rose Bloom",
    bg: "linear-gradient(135deg, #4c0519 0%, #be123c 55%, #e11d48 100%)",
    accent: "#fda4af",
    accentDark: "#be123c",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.75)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(253,164,175,0.3)",
    bullet: "#fecdd3",
    pill: "rgba(253,164,175,0.15)",
  },
  arctic: {
    name: "Arctic Aurora",
    bg: "linear-gradient(135deg, #083344 0%, #0e7490 55%, #0891b2 100%)",
    accent: "#67e8f9",
    accentDark: "#0e7490",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.75)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(103,232,249,0.3)",
    bullet: "#a5f3fc",
    pill: "rgba(103,232,249,0.15)",
  },
  volcano: {
    name: "Volcano",
    bg: "linear-gradient(135deg, #1c1917 0%, #9a3412 55%, #ea580c 100%)",
    accent: "#fb923c",
    accentDark: "#c2410c",
    text: "#ffffff",
    subtext: "rgba(255,255,255,0.75)",
    card: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(251,146,60,0.3)",
    bullet: "#fed7aa",
    pill: "rgba(251,146,60,0.15)",
  },
};

// Pick theme by topic/subject name hash
export function pickTheme(name = "") {
  const keys = Object.keys(SLIDE_THEMES);
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return keys[Math.abs(hash) % keys.length];
}

// ── Content parser ─────────────────────────────────────────────────────────────
export function parseContentToSlides(
  title = "",
  content = "",
  subject = "",
  chapter = "",
) {
  const slides = [];

  // Title slide
  slides.push({
    id: crypto.randomUUID?.() || `s${Date.now()}0`,
    type: "title",
    title: title || "Lesson",
    subtitle: [subject, chapter].filter(Boolean).join(" › ") || "Smart School",
  });

  if (!content?.trim()) {
    slides.push({
      id: crypto.randomUUID?.() || `s${Date.now()}1`,
      type: "content",
      heading: "Content",
      bullets: ["Add your lesson content here…"],
    });
    return slides;
  }

  // Strip markup tags
  let cleaned = content
    .replace(/\[VISUAL:[^\]]*\]/g, "")
    .replace(/\[KP:[^\]]*\]/g, "");

  // Split on section headers or blank lines
  const sectionPattern =
    /\b(HOOK|CONTEXT|CORE CONCEPT|WORKED EXAMPLE|COMMON MISTAKES|DEEPER INSIGHT|SUMMARY|INTRODUCTION|KEY CONCEPTS|EXAMPLES|DEEP DIVE)\s*[:\-]\s*/gi;
  const sectionParts = cleaned
    .split(sectionPattern)
    .filter((p) => p.trim().length > 5);

  let sectionSlidePairs = [];
  for (let i = 0; i < sectionParts.length; i++) {
    const part = sectionParts[i].trim();
    // If it looks like a heading keyword (short, no spaces after trim)
    if (/^[A-Z &]+$/i.test(part) && part.length < 40) {
      const body = sectionParts[i + 1] || "";
      sectionSlidePairs.push({ heading: part, body });
      i++;
    }
  }

  if (sectionSlidePairs.length === 0) {
    // Fallback: split by double newline
    const paragraphs = cleaned
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 30);
    for (let i = 0; i < paragraphs.length; i += 3) {
      const chunk = paragraphs.slice(i, i + 3);
      sectionSlidePairs.push({
        heading:
          i === 0
            ? "Overview"
            : i === paragraphs.length - 3
              ? "Key Points"
              : "Continued",
        body: chunk.join("\n\n"),
      });
    }
  }

  for (const { heading, body } of sectionSlidePairs) {
    const sentences = body
      .replace(/\n+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    // Chunk into max 4 bullets per slide
    for (let i = 0; i < sentences.length; i += 4) {
      slides.push({
        id: crypto.randomUUID?.() || `s${Date.now()}${slides.length}`,
        type: "content",
        heading:
          i === 0
            ? heading.charAt(0).toUpperCase() + heading.slice(1).toLowerCase()
            : `${heading} (cont.)`,
        bullets: sentences.slice(i, i + 4),
      });
    }
  }

  // Summary slide from last chunk of content
  const allBullets = slides
    .filter((s) => s.type === "content")
    .flatMap((s) => s.bullets)
    .slice(0, 4);

  if (allBullets.length > 0) {
    slides.push({
      id: crypto.randomUUID?.() || `s${Date.now()}99`,
      type: "summary",
      title: "Key Takeaways",
      points: allBullets
        .map((b) => b.split(".")[0].trim())
        .filter((b) => b.length > 10),
    });
  }

  return slides;
}

// ── CSS animations (injected once) ───────────────────────────────────────────
const SLIDE_STYLE = `
@keyframes sp-fade-up {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes sp-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sp-slide-right {
  from { opacity: 0; transform: translateX(-32px); }
  to   { opacity: 1; transform: translateX(0);     }
}
@keyframes sp-scale-in {
  from { opacity: 0; transform: scale(0.88); }
  to   { opacity: 1; transform: scale(1);    }
}
@keyframes sp-glow {
  0%, 100% { text-shadow: 0 0 20px rgba(255,255,255,0.3); }
  50%       { text-shadow: 0 0 40px rgba(255,255,255,0.7), 0 0 80px rgba(255,255,255,0.2); }
}
@keyframes sp-bar {
  from { width: 0; }
  to   { width: 60px; }
}
.sp-fade-up   { animation: sp-fade-up   0.6s cubic-bezier(.22,1,.36,1) both; }
.sp-fade-in   { animation: sp-fade-in   0.5s ease both; }
.sp-slide-r   { animation: sp-slide-right 0.5s cubic-bezier(.22,1,.36,1) both; }
.sp-scale-in  { animation: sp-scale-in  0.5s cubic-bezier(.22,1,.36,1) both; }
.sp-glow      { animation: sp-glow 3s ease-in-out infinite; }
.sp-bar       { animation: sp-bar 0.8s cubic-bezier(.22,1,.36,1) 0.3s both; }
`;

function injectStyles() {
  if (document.getElementById("sp-styles")) return;
  const el = document.createElement("style");
  el.id = "sp-styles";
  el.textContent = SLIDE_STYLE;
  document.head.appendChild(el);
}

// ── Single slide renderers ────────────────────────────────────────────────────
function TitleSlide({ slide, theme: t, animKey }) {
  return (
    <div
      key={animKey}
      className="absolute inset-0 flex flex-col items-center justify-center px-16 text-center"
    >
      {/* Decorative top bar */}
      <div
        className="sp-bar h-1 rounded-full mb-8"
        style={{ background: t.accent }}
      />

      <div className="sp-fade-in" style={{ animationDelay: "0.1s" }}>
        <span
          className="text-xs font-bold uppercase tracking-[0.25em] px-4 py-1.5 rounded-full mb-6 inline-block"
          style={{
            background: t.pill,
            color: t.accent,
            border: `1px solid ${t.cardBorder}`,
          }}
        >
          Smart School
        </span>
      </div>

      <h1
        className="sp-fade-up sp-glow font-extrabold leading-tight mb-6"
        style={{
          fontSize: "clamp(2rem,5vw,3.5rem)",
          color: t.text,
          animationDelay: "0.2s",
        }}
      >
        {slide.title}
      </h1>

      {slide.subtitle && (
        <p
          className="sp-fade-up text-lg font-medium"
          style={{ color: t.subtext, animationDelay: "0.4s" }}
        >
          {slide.subtitle}
        </p>
      )}

      {/* Decorative bottom dots */}
      <div
        className="sp-fade-in flex gap-2 mt-10"
        style={{ animationDelay: "0.6s" }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: i === 1 ? t.accent : t.subtext,
              opacity: i === 1 ? 1 : 0.4,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ContentSlide({ slide, theme: t, animKey }) {
  return (
    <div key={animKey} className="absolute inset-0 flex flex-col px-14 py-12">
      {/* Heading */}
      <div className="sp-slide-r mb-6" style={{ animationDelay: "0.05s" }}>
        <div
          className="h-0.5 w-10 rounded mb-3 sp-bar"
          style={{ background: t.accent }}
        />
        <h2
          className="font-bold"
          style={{ fontSize: "clamp(1.5rem,3vw,2.25rem)", color: t.text }}
        >
          {slide.heading}
        </h2>
      </div>

      {/* Bullets */}
      <div className="flex-1 flex flex-col justify-center gap-4">
        {(slide.bullets || []).map((b, i) => (
          <div
            key={i}
            className="sp-slide-r flex items-start gap-4"
            style={{ animationDelay: `${0.15 + i * 0.12}s` }}
          >
            <span
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
              style={{
                background: t.pill,
                color: t.accent,
                border: `1px solid ${t.cardBorder}`,
              }}
            >
              {i + 1}
            </span>
            <p
              className="leading-relaxed"
              style={{
                fontSize: "clamp(1rem,1.8vw,1.25rem)",
                color: t.subtext,
                flex: 1,
              }}
            >
              {b}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummarySlide({ slide, theme: t, animKey }) {
  return (
    <div
      key={animKey}
      className="absolute inset-0 flex flex-col items-center justify-center px-14 py-12 text-center"
    >
      <div className="sp-scale-in" style={{ animationDelay: "0.05s" }}>
        <span
          className="text-3xl mb-4 inline-block"
          style={{ filter: "drop-shadow(0 0 12px rgba(255,255,255,0.4))" }}
        >
          ✦
        </span>
      </div>

      <h2
        className="sp-fade-up font-extrabold mb-8"
        style={{
          fontSize: "clamp(1.5rem,3vw,2.25rem)",
          color: t.text,
          animationDelay: "0.1s",
        }}
      >
        {slide.title || "Key Takeaways"}
      </h2>

      <div className="w-full max-w-2xl space-y-3">
        {(slide.points || []).map((p, i) => (
          <div
            key={i}
            className="sp-slide-r flex items-center gap-3 px-5 py-3 rounded-xl text-left"
            style={{
              background: t.card,
              border: `1px solid ${t.cardBorder}`,
              animationDelay: `${0.2 + i * 0.1}s`,
            }}
          >
            <span className="text-lg flex-shrink-0" style={{ color: t.accent }}>
              ✓
            </span>
            <span
              style={{
                fontSize: "clamp(0.9rem,1.6vw,1.1rem)",
                color: t.subtext,
              }}
            >
              {p}
            </span>
          </div>
        ))}
      </div>

      <p
        className="sp-fade-in mt-8 text-sm font-medium"
        style={{ color: t.accent, animationDelay: "0.8s" }}
      >
        Great work! You've mastered this topic.
      </p>
    </div>
  );
}

function SlideRenderer({ slide, theme: t, animKey }) {
  if (slide.type === "title")
    return <TitleSlide slide={slide} theme={t} animKey={animKey} />;
  if (slide.type === "summary")
    return <SummarySlide slide={slide} theme={t} animKey={animKey} />;
  return <ContentSlide slide={slide} theme={t} animKey={animKey} />;
}

// ── Fullscreen presenter ──────────────────────────────────────────────────────
function FullscreenPresenter({ slides, theme: themeId, onClose }) {
  const t = SLIDE_THEMES[themeId] || SLIDE_THEMES.ocean;
  const [idx, setIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const total = slides.length;

  const go = useCallback(
    (delta) => {
      setIdx((prev) => {
        const next = Math.max(0, Math.min(total - 1, prev + delta));
        if (next !== prev) setAnimKey((k) => k + 1);
        return next;
      });
    },
    [total],
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ")
        go(1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go, onClose]);

  const slide = slides[idx];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: t.bg }}
    >
      {/* Slide area */}
      <div className="relative flex-1 overflow-hidden">
        <SlideRenderer slide={slide} theme={t} animKey={animKey} />

        {/* Slide number */}
        <div
          className="absolute bottom-4 right-6 text-xs font-mono"
          style={{ color: t.subtext }}
        >
          {idx + 1} / {total}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${((idx + 1) / total) * 100}%`,
            background: t.accent,
          }}
        />
      </div>

      {/* Controls */}
      <div
        className="flex items-center justify-between px-8 py-3"
        style={{ background: "rgba(0,0,0,0.4)" }}
      >
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white text-sm flex items-center gap-2 transition-colors"
        >
          <XMarkIcon className="h-4 w-4" /> Exit
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => go(-1)}
            disabled={idx === 0}
            className="p-2 rounded-lg transition-colors disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <ChevronLeftIcon className="h-5 w-5 text-white" />
          </button>
          <button
            onClick={() => go(1)}
            disabled={idx === total - 1}
            className="p-2 rounded-lg transition-colors disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <ChevronRightIcon className="h-5 w-5 text-white" />
          </button>
        </div>
        <span className="text-white/50 text-xs">
          ← → to navigate · Esc to exit
        </span>
      </div>
    </div>
  );
}

// ── SlidePresenter (editor + preview) ────────────────────────────────────────
export default function SlidePresenter({
  slides: initialSlides,
  theme: initialTheme = "ocean",
  onSave,
  readOnly = false,
  topicTitle = "",
  topicContent = "",
  subject = "",
  chapter = "",
}) {
  useEffect(() => {
    injectStyles();
  }, []);

  const [slides, setSlides] = useState(() => {
    if (initialSlides?.length) return initialSlides;
    return parseContentToSlides(topicTitle, topicContent, subject, chapter);
  });
  const [themeId, setThemeId] = useState(initialTheme);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [editing, setEditing] = useState(null); // null | slide object being edited
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);

  const t = SLIDE_THEMES[themeId] || SLIDE_THEMES.ocean;
  const total = slides.length;
  const current = slides[currentIdx] || slides[0];

  const navigate = (delta) => {
    setCurrentIdx((prev) => {
      const next = Math.max(0, Math.min(total - 1, prev + delta));
      if (next !== prev) setAnimKey((k) => k + 1);
      return next;
    });
  };

  const addSlide = (type = "content") => {
    const blank =
      type === "title"
        ? {
            id: crypto.randomUUID?.() || `s${Date.now()}`,
            type: "title",
            title: "New Slide",
            subtitle: "",
          }
        : type === "summary"
          ? {
              id: crypto.randomUUID?.() || `s${Date.now()}`,
              type: "summary",
              title: "Key Takeaways",
              points: ["Point 1", "Point 2"],
            }
          : {
              id: crypto.randomUUID?.() || `s${Date.now()}`,
              type: "content",
              heading: "New Section",
              bullets: ["Add your content here"],
            };
    const next = [...slides];
    next.splice(currentIdx + 1, 0, blank);
    setSlides(next);
    setCurrentIdx(currentIdx + 1);
    setAnimKey((k) => k + 1);
  };

  const deleteSlide = () => {
    if (total <= 1) return;
    const next = slides.filter((_, i) => i !== currentIdx);
    setSlides(next);
    setCurrentIdx(Math.min(currentIdx, next.length - 1));
    setAnimKey((k) => k + 1);
  };

  const applyEdit = (updated) => {
    setSlides((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditing(null);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(slides, themeId);
    } finally {
      setSaving(false);
    }
  };

  const regenerate = () => {
    const generated = parseContentToSlides(
      topicTitle,
      topicContent,
      subject,
      chapter,
    );
    setSlides(generated);
    setCurrentIdx(0);
    setAnimKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Theme picker */}
          <div className="relative">
            <button
              onClick={() => setShowThemePicker((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <SwatchIcon className="h-4 w-4" />
              {t.name}
            </button>
            {showThemePicker && (
              <div className="absolute top-9 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-2 grid grid-cols-2 gap-1 w-52">
                {Object.entries(SLIDE_THEMES).map(([id, th]) => (
                  <button
                    key={id}
                    onClick={() => {
                      setThemeId(id);
                      setShowThemePicker(false);
                    }}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${themeId === id ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300" : "hover:bg-gray-50 text-gray-700"}`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: th.accent }}
                    />
                    {th.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => addSlide("content")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              title="Add content slide"
            >
              <PlusIcon className="h-3.5 w-3.5" /> Slide
            </button>
            <button
              onClick={() => addSlide("summary")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              title="Add summary slide"
            >
              <CheckIcon className="h-3.5 w-3.5" /> Summary
            </button>
          </div>

          <button
            onClick={regenerate}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Re-generate from content"
          >
            ↺ Regenerate
          </button>

          <div className="flex-1" />

          <button
            onClick={() => {
              setEditing({ ...current });
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={deleteSlide}
            disabled={total <= 1}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-100 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setFullscreen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowsPointingOutIcon className="h-3.5 w-3.5" /> Present
          </button>
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Slides"}
            </button>
          )}
        </div>
      )}

      {/* Slide preview */}
      <div
        className="relative rounded-2xl overflow-hidden flex-1"
        style={{ background: t.bg, minHeight: 340, aspectRatio: "16/9" }}
      >
        <SlideRenderer slide={current} theme={t} animKey={animKey} />

        {/* Nav arrows */}
        <button
          onClick={() => navigate(-1)}
          disabled={currentIdx === 0}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors disabled:opacity-20"
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          <ChevronLeftIcon className="h-5 w-5 text-white" />
        </button>
        <button
          onClick={() => navigate(1)}
          disabled={currentIdx === total - 1}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors disabled:opacity-20"
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          <ChevronRightIcon className="h-5 w-5 text-white" />
        </button>

        {/* Slide counter */}
        <div
          className="absolute bottom-3 right-4 text-xs font-mono"
          style={{ color: t.subtext }}
        >
          {currentIdx + 1} / {total}
        </div>

        {/* Present button overlay */}
        {readOnly && (
          <button
            onClick={() => setFullscreen(true)}
            className="absolute bottom-3 left-4 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-white bg-black/30 hover:bg-black/50 transition-colors"
          >
            <PlayIcon className="h-3.5 w-3.5" /> Present
          </button>
        )}
      </div>

      {/* Slide strip (thumbnail nav) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => {
              setCurrentIdx(i);
              setAnimKey((k) => k + 1);
            }}
            className={`flex-shrink-0 w-20 h-12 rounded-lg overflow-hidden border-2 transition-all ${
              i === currentIdx
                ? "border-indigo-500 shadow-md scale-105"
                : "border-gray-200 hover:border-indigo-200"
            }`}
            style={{ background: t.bg }}
          >
            <div className="w-full h-full flex items-center justify-center p-1">
              <span
                className="text-white text-[7px] text-center leading-tight truncate px-1"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                {s.type === "title"
                  ? s.title?.slice(0, 18)
                  : s.type === "summary"
                    ? "✦ Summary"
                    : s.heading?.slice(0, 18)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <SlideEditor
          slide={editing}
          onApply={applyEdit}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Fullscreen presenter */}
      {fullscreen && (
        <FullscreenPresenter
          slides={slides}
          theme={themeId}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}

// ── Inline slide editor ───────────────────────────────────────────────────────
function SlideEditor({ slide, onApply, onCancel }) {
  const [draft, setDraft] = useState({ ...slide });

  const updateField = (field, val) => setDraft((d) => ({ ...d, [field]: val }));
  const updateBullet = (i, val) =>
    setDraft((d) => {
      const arr = [...(d.bullets || [])];
      arr[i] = val;
      return { ...d, bullets: arr };
    });
  const addBullet = () =>
    setDraft((d) => ({ ...d, bullets: [...(d.bullets || []), ""] }));
  const removeBullet = (i) =>
    setDraft((d) => ({
      ...d,
      bullets: d.bullets.filter((_, idx) => idx !== i),
    }));

  const updatePoint = (i, val) =>
    setDraft((d) => {
      const arr = [...(d.points || [])];
      arr[i] = val;
      return { ...d, points: arr };
    });
  const addPoint = () =>
    setDraft((d) => ({ ...d, points: [...(d.points || []), ""] }));
  const removePoint = (i) =>
    setDraft((d) => ({ ...d, points: d.points.filter((_, idx) => idx !== i) }));

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Edit Slide</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title / heading */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              {draft.type === "content" ? "Heading" : "Title"}
            </label>
            <input
              value={
                draft.type === "content"
                  ? draft.heading || ""
                  : draft.title || ""
              }
              onChange={(e) =>
                draft.type === "content"
                  ? updateField("heading", e.target.value)
                  : updateField("title", e.target.value)
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Subtitle (title slides) */}
          {draft.type === "title" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Subtitle
              </label>
              <input
                value={draft.subtitle || ""}
                onChange={(e) => updateField("subtitle", e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          {/* Bullets (content slides) */}
          {draft.type === "content" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                Bullet Points
              </label>
              <div className="space-y-2">
                {(draft.bullets || []).map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={b}
                      onChange={(e) => updateBullet(i, e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      onClick={() => removeBullet(i)}
                      className="text-red-400 hover:text-red-600 p-2"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addBullet}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <PlusIcon className="h-3.5 w-3.5" /> Add bullet
                </button>
              </div>
            </div>
          )}

          {/* Points (summary slides) */}
          {draft.type === "summary" && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                Key Points
              </label>
              <div className="space-y-2">
                {(draft.points || []).map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={p}
                      onChange={(e) => updatePoint(i, e.target.value)}
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      onClick={() => removePoint(i)}
                      className="text-red-400 hover:text-red-600 p-2"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addPoint}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <PlusIcon className="h-3.5 w-3.5" /> Add point
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(draft)}
            className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
