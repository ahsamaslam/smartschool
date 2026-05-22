import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import teacherService from "../../services/teacherService";
import libraryService from "../../services/libraryService";
import { parseLibraryTopicSlidesJson } from "../../utils/libraryTopicSlides";
import { SlideRenderer } from "../../components/slides/SlideRenderer";
import { SlideThumbnail } from "../../components/slides/SlideThumbnail";
import { SaveSlidesLibraryModal } from "../../components/slides/SaveSlidesLibraryModal";
import {
  SLIDE_TEMPLATES,
  SLIDE_LAYOUTS,
  SLIDE_ANIMATIONS,
} from "../../data/slideTemplates";
import {
  SparklesIcon,
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PresentationChartBarIcon,
  DocumentDuplicateIcon,
  XMarkIcon,
  PlayIcon,
  Squares2X2Icon,
  SwatchIcon,
  FilmIcon,
  BoltIcon,
  CheckIcon,
  ViewColumnsIcon,
  RectangleStackIcon,
  BookOpenIcon,
  PencilSquareIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";

export default function TeacherSlides() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect admins to their own slides page
  useEffect(() => {
    if (user?.role === "admin") {
      navigate("/admin/slides", { replace: true, state: location.state });
    }
  }, [user, navigate, location.state]);

  const topicFromLibrary = location.state?.topic || null;
  const libraryContextFromNav = location.state?.libraryContext || null;

  const [topicInput, setTopicInput] = useState(topicFromLibrary?.title || "");
  const [contentInput, setContentInput] = useState(
    topicFromLibrary?.content_body || topicFromLibrary?.content || "",
  );
  const [audience, setAudience] = useState("basic");
  const [tone, setTone] = useState("simple");
  const [slideCount, setSlideCount] = useState(8);
  const [persistToDb, setPersistToDb] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);

  const [template, setTemplate] = useState(SLIDE_TEMPLATES[0]);
  const [animation, setAnimation] = useState("fade");

  const [rightTab, setRightTab] = useState("templates");
  const [previewMode, setPreviewMode] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [canvasMode, setCanvasMode] = useState("focus"); // focus | storyboard
  const dragOver = useRef(null);

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [filmstripCollapsed, setFilmstripCollapsed] = useState(false);
  const [deckEditorOpen, setDeckEditorOpen] = useState(false);
  const [postSavePrompt, setPostSavePrompt] = useState(null);

  // Topic search
  const [curriculumSearch, setCurriculumSearch] = useState("");
  const [curriculum, setCurriculum] = useState([]);
  const [bookDetailsCache, setBookDetailsCache] = useState({});
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const openDeckEditor = useCallback((slideIndex) => {
    if (slideIndex != null && slideIndex >= 0) setCurrentIndex(slideIndex);
    setDeckEditorOpen(true);
    setPreviewMode(false);
  }, []);

  const closeDeckEditor = useCallback(() => setDeckEditorOpen(false), []);

  const navigateBackToLibrary = useCallback(
    (loc) => {
      if (!loc) return;
      navigate("/teacher/curriculum", {
        state: {
          libraryFocus: {
            bookId: loc.bookId,
            chapterId: loc.chapterId,
            topicId: loc.topicId,
          },
        },
      });
    },
    [navigate],
  );

  const openRecordLectureNow = useCallback(
    (loc) => {
      const topicId = loc?.topicId;
      if (!topicId) {
        toast.error("Topic ID missing for recording.");
        return;
      }
      const w = window.open(`/teacher/record-lecture/${topicId}`, "_blank");
      if (!w) {
        toast.error("Pop-up blocked. Allow pop-ups and try again.");
        return;
      }
      try {
        w.focus();
      } catch {
        /* ignore */
      }
      navigateBackToLibrary(loc);
    },
    [navigateBackToLibrary],
  );

  // Load curriculum on mount
  useEffect(() => {
    if (!user?.id) return;
    setLoadingCurriculum(true);
    teacherService
      .getMyCurriculum()
      .then((res) => {
        console.log("Curriculum loaded:", res.data);
        setCurriculum(res.data || []);
      })
      .catch((err) => {
        console.error("Failed to load curriculum:", {
          status: err?.response?.status,
          message: err?.response?.data?.detail || err?.message,
          fullError: err,
        });
      })
      .finally(() => setLoadingCurriculum(false));
  }, [user?.id]);

  // Lazy load book details
  useEffect(() => {
    curriculum.forEach((cls) => {
      cls.subjects?.forEach((subj) => {
        subj.books?.forEach((book) => {
          if (!bookDetailsCache[book.book_id]) {
            console.log("Loading book details for:", book.book_id, book.book_title);
            libraryService
              .getBookDetails(book.book_id)
              .then((res) => {
                console.log("Book details loaded:", book.book_id, res.data);
                setBookDetailsCache((prev) => ({
                  ...prev,
                  [book.book_id]: res.data,
                }));
              })
              .catch((err) => {
                console.error("Failed to load book details:", book.book_id, err);
              });
          }
        });
      });
    });
  }, [curriculum, bookDetailsCache]);

  // Flatten and filter topics (memoized)
  const searchResults = useMemo(() => {
    if (!curriculumSearch.trim()) return [];

    const query = curriculumSearch.toLowerCase();
    const results = [];
    const maxResults = 10;

    curriculum.forEach((cls) => {
      if (results.length >= maxResults) return;
      cls.subjects?.forEach((subj) => {
        if (results.length >= maxResults) return;
        subj.books?.forEach((book) => {
          if (results.length >= maxResults) return;
          const bookDetails = bookDetailsCache[book.book_id];
          if (!bookDetails) {
            console.log("Book details not cached yet:", book.book_id);
            return;
          }

          const chapters = bookDetails.chapters || bookDetails.data?.chapters || [];
          console.log("Searching chapters:", chapters.length, "for query:", query);

          chapters.forEach((ch) => {
            if (results.length >= maxResults) return;
            const topics = ch.topics || ch.library_topics || [];
            console.log("Chapter topics:", topics.length);

            topics.forEach((topic) => {
              if (results.length >= maxResults) return;

              const matchesQuery =
                topic.name?.toLowerCase().includes(query) ||
                topic.title?.toLowerCase().includes(query) ||
                ch.title?.toLowerCase().includes(query) ||
                ch.chapter_number?.toString().includes(query) ||
                book.book_title?.toLowerCase().includes(query);

              if (matchesQuery) {
                results.push({
                  id: topic.id,
                  name: topic.name || topic.title,
                  chapterNum: ch.chapter_number || "—",
                  chapterTitle: ch.title,
                  bookTitle: book.book_title,
                  className: cls.class_name,
                  subjectName: subj.subject_name,
                  topicObj: topic,
                  bookObj: book,
                  chapterObj: ch,
                });
              }
            });
          });
        });
      });
    });

    console.log("Search results:", results.length);
    return results;
  }, [curriculumSearch, curriculum, bookDetailsCache]);

  const handleSelectTopic = useCallback(
    async (result) => {
      try {
        const content = await teacherService.getMyTopicContent(result.id);
        setTopicInput(result.name);
        setContentInput(content.data?.content_body || content.data?.content || "");
      } catch {
        /* ignore */
      }
    },
    [],
  );

  // Dismiss dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest("[data-search-box]")) return;
      setShowSearchDropdown(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const currentSlide = slides[currentIndex] || null;

  const motionClass =
    SLIDE_ANIMATIONS.find(
      (a) => a.id === (currentSlide?.animation || animation),
    )?.css || "";

  const handleGenerate = async () => {
    if (!topicInput.trim()) {
      toast.error("Enter a topic first");
      return;
    }
    setGenerating(true);
    const tid = toast.loading("AI is composing your slide deck…");
    try {
      const res = await teacherService.generateAISlides({
        topic: topicInput,
        content: contentInput,
        audience,
        tone,
        slide_count: slideCount,
        persist: persistToDb,
        template_id: template.id,
      });
      const newSlides = res.data?.slides || [];
      if (!newSlides.length) throw new Error("No slides returned");
      const withIds = newSlides.map((s, i) => ({
        ...s,
        id: `s${Date.now()}_${i}`,
      }));
      setSlides(withIds);
      setCurrentIndex(0);
      if (tone === "professional") {
        const dark = SLIDE_TEMPLATES.find((t) => t.id === "dark-professional");
        if (dark) setTemplate(dark);
      }
      const via = res.data?.source === "claude" ? "Claude" : "offline mock";
      toast.success(`${withIds.length} slides ready (${via})`, { id: tid });
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || err?.message || "Generation failed",
        { id: tid },
      );
    } finally {
      setGenerating(false);
    }
  };

  const updateTitleAt = useCallback((slideIdx, val) => {
    setSlides((prev) =>
      prev.map((s, i) => (i === slideIdx ? { ...s, title: val } : s)),
    );
  }, []);

  const updateContentAt = useCallback((slideIdx, bulletIdx, val) => {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== slideIdx) return s;
        const content = [...(s.content || [])];
        if (val === null) {
          content.splice(bulletIdx, 1);
        } else {
          while (content.length <= bulletIdx) content.push("");
          content[bulletIdx] = val;
        }
        return { ...s, content };
      }),
    );
  }, []);

  const updateSlideContentLines = useCallback((slideIdx, text) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((l) => l.length > 0);
    setSlides((prev) =>
      prev.map((s, i) =>
        i === slideIdx ? { ...s, content: lines.length ? lines : [""] } : s,
      ),
    );
  }, []);

  useEffect(() => {
    const tid = topicFromLibrary?.id;
    if (!tid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await teacherService.getMyTopicContent(tid);
        const row = res.data?.data ?? res.data;
        if (cancelled || !row) return;
        const deck = parseLibraryTopicSlidesJson(row.slides_json);
        if (deck.length > 0) {
          setSlides(
            deck.map((s, idx) => ({
              ...s,
              id: s.id || `s_import_${Date.now()}_${idx}`,
            })),
          );
          setCurrentIndex(0);
        }
        if (row.slide_theme) {
          const th = SLIDE_TEMPLATES.find((t) => t.id === row.slide_theme);
          if (th) setTemplate(th);
        }
      } catch {
        /* ignore fetch errors — topic payload may still be edited */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topicFromLibrary?.id]);

  const addSlide = (afterIndex) => {
    const newSlide = {
      id: `s${Date.now()}`,
      title: "New Slide",
      content: ["Add your content here"],
      layout: "title-bullets",
      animation,
    };
    setSlides((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, newSlide);
      return next;
    });
    setCurrentIndex(afterIndex + 1);
  };

  const duplicateSlide = (index) => {
    const dup = { ...slides[index], id: `s${Date.now()}` };
    setSlides((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, dup);
      return next;
    });
    setCurrentIndex(index + 1);
  };

  const removeSlide = (index) => {
    if (slides.length <= 1) {
      toast.error("Cannot remove the only slide");
      return;
    }
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setCurrentIndex(Math.max(0, index - 1));
  };

  const updateLayout = (layoutId) => {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== currentIndex) return s;
        let animationNext = s.animation;
        if (layoutId === "title-only") animationNext = "zoom";
        else if (layoutId === "steps") animationNext = "slide-up";
        else if (layoutId === "title-bullets" || layoutId === "two-column")
          animationNext = "stagger";
        return { ...s, layout: layoutId, animation: animationNext };
      }),
    );
  };

  const updateAnimation = (animId) => {
    setAnimation(animId);
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== currentIndex) return s;
        return { ...s, animation: animId };
      }),
    );
  };

  const handleDragStart = (index) => {
    dragOver.current = index;
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (index) => {
    if (dragOver.current === null || dragOver.current === index) return;
    const from = dragOver.current;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setCurrentIndex(index);
    dragOver.current = null;
  };

  useEffect(() => {
    if (!previewMode) return;
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setPreviewIndex((p) => Math.min(p + 1, slides.length - 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setPreviewIndex((p) => Math.max(p - 1, 0));
      if (e.key === "Escape") setPreviewMode(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewMode, slides.length]);

  useEffect(() => {
    if (!deckEditorOpen) return;
    const handler = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || e.target?.isContentEditable;

      if (e.key === "Escape") {
        e.preventDefault();
        closeDeckEditor();
        return;
      }
      if (typing || slides.length < 2) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setCurrentIndex((p) => Math.min(p + 1, slides.length - 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setCurrentIndex((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deckEditorOpen, slides.length, closeDeckEditor]);

  if (previewMode && slides.length > 0) {
    const pAnim =
      SLIDE_ANIMATIONS.find((a) => a.id === slides[previewIndex]?.animation)
        ?.css || "";
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-5xl ${pAnim}`}
            style={{ aspectRatio: "16/9" }}
          >
            <SlideRenderer
              slide={slides[previewIndex]}
              template={template}
              slideIndex={previewIndex}
            />
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-3 bg-black/80 border-t border-white/10">
          <button
            type="button"
            onClick={() => setPreviewMode(false)}
            className="text-white/60 hover:text-white text-sm flex items-center gap-2"
          >
            <XMarkIcon className="h-4 w-4" /> Exit (Esc)
          </button>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setPreviewIndex((p) => Math.max(0, p - 1))}
              disabled={previewIndex === 0}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <ChevronUpIcon className="h-4 w-4" />
            </button>
            <span className="text-white/60 text-sm font-mono">
              {previewIndex + 1} / {slides.length}
            </span>
            <button
              type="button"
              onClick={() =>
                setPreviewIndex((p) => Math.min(slides.length - 1, p + 1))
              }
              disabled={previewIndex === slides.length - 1}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="text-white/40 text-xs">Use arrow keys</div>
        </div>
      </div>
    );
  }

  if (deckEditorOpen && slides.length > 0 && currentSlide) {
    const dAnim =
      SLIDE_ANIMATIONS.find(
        (a) => a.id === (slides[currentIndex]?.animation || animation),
      )?.css || "";
    return (
      <div className="fixed inset-0 z-[60] bg-[#dfe3ea] flex flex-col">
        <header className="h-11 flex-shrink-0 flex items-center justify-between px-4 bg-white border-b border-gray-200 shadow-sm gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <PencilSquareIcon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-800 truncate">
              Slide editor
            </span>
            <span className="text-xs text-gray-500 font-mono flex-shrink-0">
              {currentIndex + 1} / {slides.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
              disabled={currentIndex === 0}
              className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-35"
              title="Previous slide"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((p) => Math.min(slides.length - 1, p + 1))
              }
              disabled={currentIndex === slides.length - 1}
              className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-35"
              title="Next slide"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={closeDeckEditor}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Done{" "}
              <span className="text-white/70 text-xs hidden sm:inline">
                Esc
              </span>
            </button>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-6 min-h-0 overflow-auto">
          <div
            className={`w-full max-w-[min(1120px,100%)] rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5 bg-white ${dAnim}`}
            style={{ aspectRatio: "16/9" }}
          >
            <SlideRenderer
              slide={slides[currentIndex]}
              template={template}
              slideIndex={currentIndex}
              editing
              onUpdateTitle={(v) => updateTitleAt(currentIndex, v)}
              onUpdateContent={(bi, val) =>
                updateContentAt(currentIndex, bi, val)
              }
            />
          </div>
          <p className="mt-4 text-xs text-gray-500 text-center max-w-xl">
            Click text to edit • Arrow keys switch slides • Double-click
            thumbnails or canvas in the studio view to open this again
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#eef0f6]">
      {/* LEFT — input */}
      <div
        className={`flex-shrink-0 bg-white border-r border-gray-200/80 shadow-sm flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-out ${
          leftPanelCollapsed ? "w-11" : "w-72"
        }`}
      >
        {!leftPanelCollapsed ? (
          <>
            <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-bold text-gray-900 leading-tight">
                  AI Slide Studio
                </h1>
                <p className="text-xs text-gray-400">
                  Gamma · Canva–style authoring
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeftPanelCollapsed(true)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0"
                title="Collapse panel"
              >
                <ChevronDoubleLeftIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Topic
                </label>
                <input
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="e.g. Fractions — adding unlike denominators"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              <div data-search-box className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Search your curriculum
                </label>
                <input
                  type="text"
                  placeholder="Search topics, chapters, books…"
                  value={curriculumSearch}
                  onChange={(e) => {
                    setCurriculumSearch(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          handleSelectTopic(result);
                          setCurriculumSearch("");
                          setShowSearchDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-xs border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="text-gray-600 text-xs mb-0.5">
                          {result.className} · {result.subjectName}
                        </div>
                        <div className="font-medium text-gray-900 truncate">
                          {result.bookTitle} › Ch. {result.chapterNum}: {result.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showSearchDropdown && curriculumSearch && searchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 px-3 py-2 text-xs text-gray-500">
                    No matching topics found
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Content / notes
                </label>
                <textarea
                  value={contentInput}
                  onChange={(e) => setContentInput(e.target.value)}
                  placeholder="Paste textbook paragraphs, bullets, or leave blank…"
                  rows={6}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Audience
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["basic", "Basic"],
                    ["advanced", "Advanced"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAudience(val)}
                      className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                        audience === val
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Tone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["simple", "Simple"],
                    ["professional", "Professional"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTone(val)}
                      className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                        tone === val
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Slides{" "}
                  <span className="text-indigo-600 font-bold">
                    {slideCount}
                  </span>
                </label>
                <input
                  type="range"
                  min={4}
                  max={20}
                  step={1}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>4</span>
                  <span>12</span>
                  <span>20</span>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={persistToDb}
                  onChange={(e) => setPersistToDb(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Log generation to database (audit)
              </label>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !topicInput.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold shadow-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4" />
                    Generate slides
                  </>
                )}
              </button>

              {slides.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setBulkEditorOpen((o) => !o)}
                    className={`w-full py-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                      bulkEditorOpen
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-indigo-200"
                    }`}
                  >
                    <Squares2X2Icon className="h-4 w-4" />{" "}
                    {bulkEditorOpen ? "Hide" : "Show"} bulk text editor
                  </button>

                  {bulkEditorOpen && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50/90 p-2 max-h-64 overflow-y-auto space-y-2">
                      {slides.map((sl, idx) => (
                        <details
                          key={sl.id || idx}
                          className="group rounded-lg bg-white border border-gray-100 px-2 py-1.5"
                        >
                          <summary className="text-[11px] font-bold text-gray-600 cursor-pointer list-none flex justify-between items-center [&::-webkit-details-marker]:hidden">
                            <span>
                              Slide {idx + 1}
                              <span className="font-normal text-gray-400 ml-1 truncate max-w-[8rem] inline-block align-bottom">
                                {sl.title}
                              </span>
                            </span>
                            <ChevronDownIcon className="h-3 w-3 text-gray-400 group-open:rotate-180 transition-transform" />
                          </summary>
                          <div className="pt-2 space-y-2 pb-1">
                            <input
                              type="text"
                              value={sl.title}
                              onChange={(e) =>
                                updateTitleAt(idx, e.target.value)
                              }
                              className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs"
                              placeholder="Title"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <label className="block text-[10px] uppercase font-semibold text-gray-400">
                              Lines (bullet / step / column items)
                            </label>
                            <textarea
                              value={(sl.content || []).join("\n")}
                              onChange={(e) =>
                                updateSlideContentLines(idx, e.target.value)
                              }
                              rows={Math.min(
                                8,
                                Math.max(3, (sl.content || []).length + 2),
                              )}
                              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-mono"
                              placeholder="One line per bullet..."
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </details>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSaveModalOpen(true)}
                    className="w-full py-2.5 rounded-xl border-2 border-indigo-600 text-indigo-600 text-sm font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                  >
                    <BookOpenIcon className="h-4 w-4" /> Save to Library…
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center pt-4 gap-2 flex-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              title="Back"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLeftPanelCollapsed(false)}
              className="p-2 rounded-lg hover:bg-gray-100 text-indigo-600"
              title="Expand AI panel"
            >
              <ChevronDoubleRightIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* CENTER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        <div className="h-12 flex-shrink-0 bg-white/90 backdrop-blur border-b border-gray-200/80 flex items-center justify-between px-4 gap-3 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <PresentationChartBarIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-800 truncate">
              {topicInput || "Untitled deck"}
            </span>
            {slides.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                {slides.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {slides.length > 0 && (
              <>
                <div className="flex rounded-lg bg-gray-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setCanvasMode("focus")}
                    title="Primary canvas"
                    className={`p-1.5 rounded-md ${canvasMode === "focus" ? "bg-white shadow text-indigo-700" : "text-gray-500"}`}
                  >
                    <RectangleStackIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasMode("storyboard")}
                    title="All slides as cards"
                    className={`p-1.5 rounded-md ${canvasMode === "storyboard" ? "bg-white shadow text-indigo-700" : "text-gray-500"}`}
                  >
                    <ViewColumnsIcon className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => openDeckEditor()}
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-800 text-xs font-semibold hover:bg-gray-50 transition-colors"
                  title="Large editing view (double-click canvas or thumbnail)"
                >
                  <PencilSquareIcon className="h-3.5 w-3.5" /> Full edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeckEditorOpen(false);
                    setPreviewIndex(currentIndex);
                    setPreviewMode(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
                >
                  <PlayIcon className="h-3.5 w-3.5" /> Present
                </button>
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-50 transition-colors"
                >
                  <BookOpenIcon className="h-3.5 w-3.5" /> Library
                </button>
                <button
                  type="button"
                  onClick={() => addSlide(currentIndex)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition-colors"
                >
                  <PlusIcon className="h-3.5 w-3.5" /> Add
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {slides.length > 0 && (
            <>
              <div
                className={`flex-shrink-0 bg-[#dfe3ea] border-r border-gray-200/90 flex flex-col items-center gap-2 py-3 overflow-y-auto overflow-x-hidden transition-[width,max-width] duration-200 ease-out ${
                  filmstripCollapsed
                    ? "w-0 max-w-0 border-transparent p-0"
                    : "w-36 max-w-36 px-2"
                }`}
              >
                {!filmstripCollapsed &&
                  slides.map((slide, i) => (
                    <div
                      key={slide.id}
                      className="flex flex-col items-center gap-0.5 w-full group/thumb"
                    >
                      <SlideThumbnail
                        slide={slide}
                        template={template}
                        index={i}
                        isSelected={i === currentIndex}
                        onClick={() => setCurrentIndex(i)}
                        onDoubleClickOpen={() => openDeckEditor(i)}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(i)}
                      />
                      <div
                        className={`flex gap-1 opacity-100 ${i === currentIndex ? "" : "md:opacity-0 md:group-hover/thumb:opacity-100"} transition-opacity`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateSlide(i);
                          }}
                          title="Duplicate"
                          className="p-0.5 text-gray-500 hover:text-indigo-600"
                        >
                          <DocumentDuplicateIcon className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSlide(i);
                          }}
                          title="Delete"
                          className="p-0.5 text-gray-500 hover:text-red-500"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="w-9 flex-shrink-0 flex flex-col items-center pt-3 bg-[#c8cedc] border-r border-gray-200/70">
                <button
                  type="button"
                  onClick={() => setFilmstripCollapsed((c) => !c)}
                  className="p-1.5 rounded-lg text-gray-600 hover:bg-black/10 hover:text-gray-900"
                  title={
                    filmstripCollapsed
                      ? "Show slide thumbnails"
                      : "Hide thumbnails for more canvas space"
                  }
                >
                  {filmstripCollapsed ? (
                    <ChevronRightIcon className="h-5 w-5" />
                  ) : (
                    <ChevronLeftIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </>
          )}

          <div className="flex-1 overflow-auto bg-[#cdd2df] flex items-start justify-center p-6 min-w-0">
            {slides.length === 0 ? (
              <div className="text-center max-w-md mt-24">
                <div className="w-28 h-28 mx-auto mb-8 rounded-[2rem] bg-white shadow-xl flex items-center justify-center border border-white/60">
                  <SparklesIcon className="h-14 w-14 text-indigo-300" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Design-grade decks
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Describe your lesson on the left. We structure layouts, split
                  screens, steps, and motion — then you polish like a pro
                  editor.
                </p>
              </div>
            ) : canvasMode === "focus" && currentSlide ? (
              <div className="flex flex-col items-center gap-5 w-full max-w-[min(100%,56rem)]">
                <div
                  className={`w-full shadow-2xl rounded-xl overflow-hidden ring-1 ring-black/5 cursor-default ${motionClass}`}
                  style={{ aspectRatio: "16/9" }}
                  onDoubleClick={(e) => {
                    const t = e.target;
                    if (!(t instanceof Element)) return;
                    if (
                      t.closest(
                        "input, textarea, button, [contenteditable='true']",
                      )
                    )
                      return;
                    openDeckEditor();
                  }}
                  title="Double-click outside text fields for full-slide editor"
                >
                  <SlideRenderer
                    slide={currentSlide}
                    template={template}
                    slideIndex={currentIndex}
                    editing
                    onUpdateTitle={(v) => updateTitleAt(currentIndex, v)}
                    onUpdateContent={(bi, val) =>
                      updateContentAt(currentIndex, bi, val)
                    }
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
                    disabled={currentIndex === 0}
                    className="p-2 rounded-xl bg-white shadow hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronUpIcon className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="text-sm text-gray-600 font-medium min-w-20 text-center">
                    {currentIndex + 1} / {slides.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((p) => Math.min(slides.length - 1, p + 1))
                    }
                    disabled={currentIndex === slides.length - 1}
                    className="p-2 rounded-xl bg-white shadow hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronDownIcon className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
                {slides.map((slide, i) => {
                  const cls =
                    SLIDE_ANIMATIONS.find((a) => a.id === slide.animation)
                      ?.css || "";
                  return (
                    <div
                      tabIndex={0}
                      key={slide.id}
                      onClick={(e) => {
                        if (e.target.closest("input, textarea, button")) return;
                        setCurrentIndex(i);
                      }}
                      onDoubleClick={(e) => {
                        if (e.target.closest("input, textarea, button")) return;
                        openDeckEditor(i);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setCurrentIndex(i);
                        }
                      }}
                      className={`text-left rounded-2xl bg-white shadow-lg ring-2 transition hover:shadow-xl overflow-hidden cursor-pointer outline-none focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                        i === currentIndex
                          ? "ring-indigo-500"
                          : "ring-transparent"
                      }`}
                    >
                      <div className={`${cls}`} style={{ aspectRatio: "16/9" }}>
                        <SlideRenderer
                          slide={slide}
                          template={template}
                          slideIndex={i}
                          editing
                          onUpdateTitle={(v) => updateTitleAt(i, v)}
                          onUpdateContent={(bi, val) =>
                            updateContentAt(i, bi, val)
                          }
                        />
                      </div>
                      <div className="px-3 py-2 flex items-center justify-between bg-gray-50 border-t border-gray-100 pointer-events-none">
                        <span className="text-[11px] font-semibold text-gray-500">
                          {i + 1}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-indigo-600 font-bold">
                          {slide.layout}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT — design */}
      <div
        className={`flex-shrink-0 bg-white border-l border-gray-200/80 shadow-sm flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-out ${
          rightPanelCollapsed ? "w-11" : "w-[19rem]"
        }`}
      >
        {rightPanelCollapsed ? (
          <div className="flex flex-col items-center py-3 gap-2 flex-1 border-l border-gray-100">
            <button
              type="button"
              onClick={() => setRightPanelCollapsed(false)}
              className="p-2 rounded-lg hover:bg-gray-100 text-indigo-600"
              title="Themes, layouts & motion"
            >
              <ChevronDoubleLeftIcon className="h-5 w-5 rotate-180" />
            </button>
            <SwatchIcon className="h-4 w-4 text-gray-300" aria-hidden />
            <Squares2X2Icon className="h-4 w-4 text-gray-300" aria-hidden />
            <FilmIcon className="h-4 w-4 text-gray-300" aria-hidden />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 py-2 border-b border-gray-200 bg-gray-50/80">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide pl-1">
                Design
              </span>
              <button
                type="button"
                onClick={() => setRightPanelCollapsed(true)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                title="Collapse design panel"
              >
                <ChevronDoubleRightIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex border-b border-gray-200 bg-gray-50/50">
              {[
                { key: "templates", icon: SwatchIcon, label: "Themes" },
                { key: "layouts", icon: Squares2X2Icon, label: "Layouts" },
                { key: "animations", icon: FilmIcon, label: "Motion" },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRightTab(key)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${
                    rightTab === key
                      ? "border-indigo-600 text-indigo-700 bg-white"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {rightTab === "templates" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-2">
                    {SLIDE_TEMPLATES.length} premium looks — swap instantly
                  </p>
                  {Object.entries(
                    SLIDE_TEMPLATES.reduce((acc, t) => {
                      (acc[t.category] = acc[t.category] || []).push(t);
                      return acc;
                    }, {}),
                  ).map(([category, templates]) => (
                    <div key={category} className="mb-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        {category}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {templates.map((t) => (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => setTemplate(t)}
                            className={`relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                              template.id === t.id
                                ? "border-indigo-500 shadow-md scale-[1.02]"
                                : "border-transparent hover:border-gray-300"
                            }`}
                          >
                            <div
                              className="h-14 w-full flex"
                              style={{
                                background:
                                  typeof t.css.slideBackground === "string"
                                    ? t.css.slideBackground
                                    : "#fff",
                              }}
                            >
                              <div className="flex-1 flex flex-col justify-center px-2 gap-1">
                                <div
                                  className="h-1.5 rounded-full w-10"
                                  style={{
                                    background: t.css.titleColor,
                                    opacity: 0.9,
                                  }}
                                />
                                <div
                                  className="h-1 rounded-full w-16"
                                  style={{
                                    background: t.css.bodyColor,
                                    opacity: 0.55,
                                  }}
                                />
                                <div
                                  className="h-1 rounded-full w-12"
                                  style={{
                                    background: t.css.accentColor,
                                    opacity: 0.5,
                                  }}
                                />
                              </div>
                              <div
                                className="w-1.5 self-stretch"
                                style={{ background: t.css.accentColor }}
                              />
                            </div>
                            <div
                              className={`px-2 py-1.5 text-center ${template.id === t.id ? "bg-indigo-50" : "bg-gray-50"}`}
                            >
                              <span className="text-[10px] font-semibold text-gray-700 leading-tight block">
                                {t.name}
                              </span>
                            </div>
                            {template.id === t.id && (
                              <div className="absolute top-1 right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center">
                                <CheckIcon className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {rightTab === "layouts" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-2">
                    Current slide structure
                  </p>
                  {SLIDE_LAYOUTS.map((layout) => (
                    <button
                      type="button"
                      key={layout.id}
                      onClick={() => currentSlide && updateLayout(layout.id)}
                      disabled={!currentSlide}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 ${
                        currentSlide?.layout === layout.id
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-indigo-300 bg-white"
                      }`}
                    >
                      <span
                        className="text-lg w-8 text-center font-bold"
                        style={{
                          color:
                            currentSlide?.layout === layout.id
                              ? "#4f46e5"
                              : "#9ca3af",
                        }}
                      >
                        {layout.icon}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {layout.name}
                        </p>
                        <p className="text-xs text-gray-400">{layout.desc}</p>
                      </div>
                      {currentSlide?.layout === layout.id && (
                        <CheckIcon className="h-4 w-4 text-indigo-600 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {rightTab === "animations" && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-2">
                    Entrance motion (present mode + canvas)
                  </p>
                  {SLIDE_ANIMATIONS.map((anim) => (
                    <button
                      type="button"
                      key={anim.id}
                      onClick={() => updateAnimation(anim.id)}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border-2 text-left transition-all ${
                        (currentSlide?.animation || animation) === anim.id
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-indigo-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <BoltIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-800">
                          {anim.name}
                        </span>
                      </div>
                      {(currentSlide?.animation || animation) === anim.id && (
                        <CheckIcon className="h-4 w-4 text-indigo-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentSlide && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 flex-shrink-0">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Slide {currentIndex + 1}
                </p>
                <p className="text-xs text-gray-800 truncate font-semibold mt-0.5">
                  {currentSlide.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                    {currentSlide.layout}
                  </span>
                  <span className="text-[10px] bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                    {currentSlide.animation || animation}
                  </span>
                  <span className="text-[10px] bg-white text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                    {template.name}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <SaveSlidesLibraryModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        slides={slides}
        slideThemeId={template.id}
        lessonNotes={contentInput}
        suggestedTitle={topicInput}
        initialContext={libraryContextFromNav}
        existingLibraryTopicId={topicFromLibrary?.id}
        topicHint={topicFromLibrary}
        onComplete={(loc) => setPostSavePrompt(loc)}
        userRole={user?.role}
      />

      {postSavePrompt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Slides saved successfully
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Do you want to record a lecture for this topic now?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  const loc = postSavePrompt;
                  setPostSavePrompt(null);
                  openRecordLectureNow(loc);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
              >
                Record Lecture Now
              </button>
              <button
                type="button"
                onClick={() => {
                  const loc = postSavePrompt;
                  setPostSavePrompt(null);
                  navigateBackToLibrary(loc);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Skip For Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
