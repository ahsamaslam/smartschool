import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function SlideViewer() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const topicId = searchParams.get("topic");

  useEffect(() => {
    if (!topicId) {
      setError("No topic selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    teacherService
      .getMyTopicContent(topicId)
      .then((res) => {
        setContent(res.data);
      })
      .catch(() => setError("Failed to load slides"))
      .finally(() => setLoading(false));
  }, [topicId]);

  if (loading) return <PageSpinner />;
  if (error) return <Alert type="error" message={error} />;
  if (!content?.slides_json) {
    return <Alert type="error" message="No slides found for this topic" />;
  }

  let slides = [];
  try {
    const parsed = JSON.parse(content.slides_json);
    slides = Array.isArray(parsed) ? parsed : [];
  } catch {
    return <Alert type="error" message="Failed to parse slides" />;
  }

  if (slides.length === 0) {
    return <Alert type="error" message="No slides in this presentation" />;
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

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-lg">
            {content.topic_title || "Slide Presentation"}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Slide {currentIndex + 1} of {slides.length}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors p-2"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Slide Display */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-6 py-8">
        <div className="w-full max-w-4xl">
          {currentSlide.title && (
            <h2 className="text-white text-5xl font-bold mb-8">
              {currentSlide.title}
            </h2>
          )}
          {currentSlide.content && (
            <div className="text-gray-200 text-xl leading-relaxed whitespace-pre-wrap">
              {currentSlide.content}
            </div>
          )}
          {currentSlide.html && (
            <div
              className="text-gray-200"
              dangerouslySetInnerHTML={{ __html: currentSlide.html }}
            />
          )}
        </div>
      </div>

      {/* Footer with Controls */}
      <div className="bg-gray-900 border-t border-gray-800 px-6 py-4 flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={!hasPrev}
          className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                idx === currentIndex ? "w-8 bg-blue-500" : "w-2 bg-gray-600 hover:bg-gray-500"
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={!hasNext}
          className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Keyboard Help */}
      <div className="bg-gray-950 border-t border-gray-800 px-6 py-2 text-center text-gray-500 text-xs">
        Use arrow keys to navigate, ESC to exit
      </div>
    </div>
  );
}
