import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";

const LIMIT = 25;

export default function MySlides() {
  const { user } = useAuth();
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    setError("");

    teacherService
      .listMySlides({ limit: LIMIT, offset })
      .then((res) => {
        const slides = res.data?.data || [];
        const total = res.data?.total || 0;
        setSlides(Array.isArray(slides) ? slides : []);
        setTotal(total);
      })
      .catch((err) => {
        console.error("MySlides API Error:", err);
        setError("Failed to load slides.");
      })
      .finally(() => setLoading(false));
  }, [user?.id, offset]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && offset === 0) return <PageSpinner />;

  const hasMore = offset + LIMIT < total;
  const hasPrev = offset > 0;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Slides</h1>
          <p className="text-sm text-gray-500 mt-1">
            View all slides you've created
          </p>
        </div>
        <Link to="/teacher/slides">
          <Button variant="primary">+ Create Slides</Button>
        </Link>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {slides.length === 0 && !loading && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-12 text-center">
          <p className="text-sm text-gray-600">
            No slides yet. Click "Create Slides" to get started.
          </p>
        </div>
      )}

      {slides.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm min-h-[160px]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 text-base leading-tight pr-2 line-clamp-2">
                    {slide.title || "Untitled Slide"}
                  </h3>
                </div>

                <p className="text-xs text-indigo-600 font-medium mb-1">
                  {slide.class_name ? `${slide.class_name} · ` : ""}
                  {slide.subject_name || ""}
                </p>

                <p className="text-xs text-gray-500 mb-3">
                  {slide.book_title}
                  {slide.chapter_number && (
                    <span>{' >'} Chapter {slide.chapter_number}</span>
                  )}
                  {slide.chapter_title && <span>: {slide.chapter_title}</span>}
                </p>

                <div className="mt-auto flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
                  <span>
                    {slide.created_at
                      ? new Date(slide.created_at).toLocaleDateString()
                      : ""}
                  </span>
                  <span className="text-gray-500 font-medium">
                    {slide.slide_theme || "Default"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(hasPrev || hasMore) && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={!hasPrev}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-sm text-gray-600">
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={!hasMore}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {loading && offset > 0 && (
        <div className="py-8 text-center text-sm text-gray-400">
          Loading more slides…
        </div>
      )}
    </div>
  );
}
