import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function SlideViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const topicId = searchParams.get("topic");

  const fetchContent = () => {
    if (!topicId) {
      setError("No topic selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    teacherService
      .getMyTopicContent(topicId)
      .then((res) => {
        console.log("SlideViewer: API response:", res.data);
        setContent(res.data.data);
      })
      .catch((err) => {
        console.error("SlideViewer: API error:", err);
        setError("Failed to load slides");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    console.log("SlideViewer: topicId from searchParams:", topicId);
    fetchContent();
  }, [topicId]);

  // Refetch when page becomes visible (user returns from editing)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("SlideViewer: Page became visible, refetching content...");
        fetchContent();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [topicId]);

  let slides = [];
  try {
    if (content?.slides_json) {
      const parsed = JSON.parse(content.slides_json);
      slides = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error("Failed to parse slides:", e);
  }

  const currentSlide = slides[currentIndex] || {};
  const hasNext = currentIndex < slides.length - 1;
  const hasPrev = currentIndex > 0;

  const handleNext = () => {
    if (hasNext) setCurrentIndex(currentIndex + 1);
  };

  const handlePrev = () => {
    if (hasPrev) setCurrentIndex(currentIndex - 1);
  };

  const handleKeyPress = (e) => {
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "Escape") navigate(-1);
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentIndex, slides.length]);

  if (loading) return <PageSpinner />;
  if (error) return <Alert type="error" message={error} />;
  if (!content?.slides_json) {
    return <Alert type="error" message="No slides found for this topic" />;
  }
  if (slides.length === 0) {
    return <Alert type="error" message="No slides in this presentation" />;
  }

  const getThemeClasses = () => {
    const theme = content?.slide_theme || "minimal-clean";
    // Map all theme IDs to background/text color classes
    const themes = {
      // Light/Minimal themes
      "minimal-clean": { bg: "bg-white", text: "text-gray-900", controlBg: "bg-gray-100", controlText: "text-gray-700" },
      "pastel-soft": { bg: "bg-yellow-50", text: "text-gray-900", controlBg: "bg-yellow-100", controlText: "text-gray-700" },
      "scandi-hygge": { bg: "bg-blue-50", text: "text-gray-900", controlBg: "bg-blue-100", controlText: "text-gray-700" },
      "golden-warm": { bg: "bg-amber-50", text: "text-gray-900", controlBg: "bg-amber-100", controlText: "text-gray-700" },
      "rose-bloom": { bg: "bg-pink-50", text: "text-gray-900", controlBg: "bg-pink-100", controlText: "text-gray-700" },
      "lavender-dream": { bg: "bg-purple-50", text: "text-gray-900", controlBg: "bg-purple-100", controlText: "text-gray-700" },
      "zen-washi": { bg: "bg-amber-50", text: "text-gray-900", controlBg: "bg-amber-100", controlText: "text-gray-700" },
      "arctic-frost": { bg: "bg-cyan-50", text: "text-gray-900", controlBg: "bg-cyan-100", controlText: "text-gray-700" },
      "card-modern": { bg: "bg-white", text: "text-gray-900", controlBg: "bg-gray-100", controlText: "text-gray-700" },
      "editorial-magazine": { bg: "bg-white", text: "text-gray-900", controlBg: "bg-gray-100", controlText: "text-gray-700" },
      "split-gamma": { bg: "bg-white", text: "text-gray-900", controlBg: "bg-gray-100", controlText: "text-gray-700" },
      "newspaper": { bg: "bg-gray-50", text: "text-gray-900", controlBg: "bg-gray-200", controlText: "text-gray-700" },
      "terracotta-clay": { bg: "bg-orange-50", text: "text-gray-900", controlBg: "bg-orange-100", controlText: "text-gray-700" },
      "copper-line": { bg: "bg-amber-50", text: "text-gray-900", controlBg: "bg-amber-100", controlText: "text-gray-700" },
      "sage-editorial": { bg: "bg-green-50", text: "text-gray-900", controlBg: "bg-green-100", controlText: "text-gray-700" },
      "candy-swirl": { bg: "bg-pink-50", text: "text-gray-900", controlBg: "bg-pink-100", controlText: "text-gray-700" },
      "pop-duo": { bg: "bg-white", text: "text-gray-900", controlBg: "bg-gray-100", controlText: "text-gray-700" },
      "luxury-marble": { bg: "bg-slate-50", text: "text-gray-900", controlBg: "bg-slate-100", controlText: "text-gray-700" },
      // Dark/Bold themes
      "dark-professional": { bg: "bg-gray-900", text: "text-white", controlBg: "bg-black", controlText: "text-gray-300" },
      "midnight": { bg: "bg-gray-950", text: "text-white", controlBg: "bg-black", controlText: "text-gray-300" },
      "blackboard": { bg: "bg-gray-900", text: "text-white", controlBg: "bg-black", controlText: "text-gray-300" },
      "neon-cyber": { bg: "bg-gray-950", text: "text-white", controlBg: "bg-gray-900", controlText: "text-gray-300" },
      "matrix-code": { bg: "bg-gray-950", text: "text-white", controlBg: "bg-black", controlText: "text-gray-300" },
      "brutalist-raw": { bg: "bg-gray-800", text: "text-white", controlBg: "bg-gray-900", controlText: "text-gray-300" },
      "miami-vapor": { bg: "bg-gray-900", text: "text-white", controlBg: "bg-black", controlText: "text-gray-300" },
      "ink-bleed": { bg: "bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-950", text: "text-purple-50", controlBg: "bg-indigo-900", controlText: "text-purple-100" },
      // Blue/Professional themes
      "corporate-blue": { bg: "bg-blue-50", text: "text-gray-900", controlBg: "bg-blue-100", controlText: "text-gray-700" },
      "ocean-gradient": { bg: "bg-blue-50", text: "text-gray-900", controlBg: "bg-blue-100", controlText: "text-gray-700" },
      "blueprint-tech": { bg: "bg-blue-50", text: "text-gray-900", controlBg: "bg-blue-100", controlText: "text-gray-700" },
      "saas-mint": { bg: "bg-emerald-50", text: "text-gray-900", controlBg: "bg-emerald-100", controlText: "text-gray-700" },
      // Other themes
      "glassmorphism": { bg: "bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900", text: "text-white", controlBg: "bg-gray-800", controlText: "text-gray-300" },
      "emerald-nature": { bg: "bg-green-50", text: "text-gray-900", controlBg: "bg-green-100", controlText: "text-gray-700" },
      "royal-purple": { bg: "bg-purple-50", text: "text-gray-900", controlBg: "bg-purple-100", controlText: "text-gray-700" },
      "bold-geometric": { bg: "bg-white", text: "text-gray-900", controlBg: "bg-gray-100", controlText: "text-gray-700" },
      "volcano": { bg: "bg-red-50", text: "text-gray-900", controlBg: "bg-red-100", controlText: "text-gray-700" },
      "nordic-slate": { bg: "bg-slate-50", text: "text-gray-900", controlBg: "bg-slate-100", controlText: "text-gray-700" },
    };
    return themes[theme] || themes["minimal-clean"];
  };

  const themeClasses = getThemeClasses();

  return (
    <div className={`fixed inset-0 ${themeClasses.bg} flex flex-col z-50`}>
      {/* Header */}
      <div className={`${themeClasses.controlBg} border-b border-gray-200 px-6 py-4 flex items-center justify-between`}>
        <div>
          <h1 className={`${themeClasses.text} font-bold text-lg`}>
            {content.topic_title || "Slide Presentation"}
          </h1>
          <p className={`${themeClasses.text} opacity-60 text-sm mt-1`}>
            Slide {currentIndex + 1} of {slides.length}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className={`${themeClasses.text} hover:opacity-70 transition-opacity p-2`}
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Slide Display */}
      <div className={`flex-1 flex items-center justify-center overflow-hidden px-6 py-8 ${themeClasses.bg}`}>
        <div className="w-full max-w-4xl">
          {currentSlide.title && (
            <h2 className={`${themeClasses.text} text-5xl font-bold mb-8`}>
              {currentSlide.title}
            </h2>
          )}
          {currentSlide.content && (
            <div className={`${themeClasses.text} text-xl leading-relaxed whitespace-pre-wrap`}>
              {currentSlide.content}
            </div>
          )}
          {currentSlide.html && (
            <div
              className={themeClasses.text}
              dangerouslySetInnerHTML={{ __html: currentSlide.html }}
            />
          )}
        </div>
      </div>

      {/* Footer with Controls */}
      <div className={`${themeClasses.controlBg} border-t border-gray-200 px-6 py-4 flex items-center justify-between`}>
        <button
          onClick={handlePrev}
          disabled={!hasPrev}
          className={`flex items-center gap-2 px-4 py-2 ${themeClasses.controlText} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        >
          <ChevronLeftIcon className="h-5 w-5" />
          Previous
        </button>

        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex ? "w-8 bg-blue-500" : "w-2 bg-gray-400 hover:bg-gray-500"
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={!hasNext}
          className={`flex items-center gap-2 px-4 py-2 ${themeClasses.controlText} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        >
          Next
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Keyboard Help */}
      <div className={`${themeClasses.controlBg} border-t border-gray-200 px-6 py-2 text-center ${themeClasses.text} opacity-60 text-xs`}>
        Use arrow keys to navigate, ESC to exit
      </div>
    </div>
  );
}
