import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import libraryService from "../../services/libraryService";
import { XMarkIcon } from "@heroicons/react/24/outline";

function stripSlideIds(slides) {
  return slides.map(({ id: _omit, ...rest }) => ({ ...rest }));
}

/**
 * Modal: choose Library class → subject → book → chapter, then save deck to new or existing topic.
 */
export function SaveSlidesLibraryModal({
  open,
  onClose,
  slides,
  slideThemeId,
  lessonNotes,
  suggestedTitle,
  /** { libraryClass, subject, book, chapter } when arriving from Library */
  initialContext,
  /** Library topic UUID when updating in place */
  existingLibraryTopicId,
  /** topic row from Library navigation (includes id, chapter_id if present) */
  topicHint,
  onComplete,
}) {
  const [saving, setSaving] = useState(false);

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState("");
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState("");
  const [mode, setMode] = useState("existing"); // existing | new
  const [newTitle, setNewTitle] = useState(suggestedTitle || "");
  const [existingTopicId, setExistingTopicId] = useState("");

  const topicsInChapter = useMemo(() => {
    const ch = chapters.find((c) => c.id === chapterId);
    return ch?.topics || [];
  }, [chapters, chapterId]);

  useEffect(() => {
    setNewTitle(suggestedTitle || "");
  }, [suggestedTitle, open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await libraryService.getLibraryClasses();
        const list = res.data?.data ?? res.data ?? [];
        setClasses(Array.isArray(list) ? list : []);
      } catch {
        toast.error("Could not load library classes");
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !classId) {
      setSubjects([]);
      return;
    }
    (async () => {
      try {
        const res = await libraryService.getClassSubjects(classId);
        const list = res.data?.data ?? res.data ?? [];
        setSubjects(Array.isArray(list) ? list : []);
      } catch {
        toast.error("Could not load subjects");
      }
    })();
  }, [open, classId]);

  useEffect(() => {
    if (!open || !classId || !subjectId) {
      setBooks([]);
      return;
    }
    (async () => {
      try {
        const res = await libraryService.getBooks(classId, subjectId);
        const list = res.data?.data ?? res.data ?? [];
        setBooks(Array.isArray(list) ? list : []);
      } catch {
        toast.error("Could not load books");
      }
    })();
  }, [open, classId, subjectId]);

  useEffect(() => {
    if (!open || !bookId) {
      setChapters([]);
      return;
    }
    (async () => {
      try {
        const res = await libraryService.getBookDetails(bookId);
        const book = res.data?.data ?? res.data;
        setChapters(Array.isArray(book?.chapters) ? book.chapters : []);
      } catch {
        toast.error("Could not load chapters");
      }
    })();
  }, [open, bookId]);

  useEffect(() => {
    if (!open) return;
    const ctx = initialContext;
    setClassId(ctx?.libraryClass?.id || "");
    setSubjectId(ctx?.subject?.id || "");
    setBookId(ctx?.book?.id || "");
    setChapterId(ctx?.chapter?.id || "");

    const tid =
      existingLibraryTopicId ||
      topicHint?.id ||
      "";
    setExistingTopicId(tid || "");
    setMode(tid ? "existing" : "new");
  }, [open, initialContext, existingLibraryTopicId, topicHint]);

  useEffect(() => {
    if (!open || topicsInChapter.length === 0 || mode !== "existing") return;
    if (existingTopicId && topicsInChapter.some((t) => t.id === existingTopicId)) return;
    if (topicsInChapter.length && !topicsInChapter.some((t) => t.id === existingTopicId)) {
      setExistingTopicId(topicsInChapter[0].id);
    }
  }, [open, topicsInChapter, existingTopicId, mode]);

  useEffect(() => {
    if (!open || mode !== "existing" || !existingTopicId) return;
    const found = topicsInChapter.find((x) => x.id === existingTopicId);
    if (found?.title) setNewTitle(found.title);
  }, [open, mode, existingTopicId, topicsInChapter]);

  if (!open) return null;

  const handleSave = async () => {
    if (!slides?.length) {
      toast.error("No slides to save");
      return;
    }
    if (!chapterId) {
      toast.error("Pick a chapter first");
      return;
    }

    const payloadSlides = stripSlideIds(slides);
    const bodyNotes = lessonNotes || "";
    const titleForNew = (newTitle || suggestedTitle || "Untitled topic").trim();

    setSaving(true);
    try {
      if (mode === "existing" && existingTopicId) {
        await libraryService.updateTopic(existingTopicId, {
          title: titleForNew,
          content_body: bodyNotes,
          slides: payloadSlides,
          slide_theme: slideThemeId,
        });
        toast.success("Slides saved to library topic. Open the book to use View slides / Record lecture.", { duration: 4500 });
        onComplete?.({ bookId, chapterId, topicId: existingTopicId });
      } else {
        const res = await libraryService.createChapterTopic(chapterId, {
          title: titleForNew,
          content_body: bodyNotes,
          slides: payloadSlides,
          slide_theme: slideThemeId,
        });
        const row = res.data?.data ?? res.data;
        const newId = row?.id;
        if (!newId) throw new Error("No topic id returned");
        toast.success("Created library topic with slides. Open the book to use View slides / Record lecture.", { duration: 4500 });
        onComplete?.({ bookId, chapterId, topicId: newId });
      }
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Save deck to Library</h2>
            <p className="text-xs text-gray-500">Class → Subject → Book → Chapter → Topic</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</span>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSubjectId("");
                setBookId("");
                setChapterId("");
              }}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</span>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setBookId("");
                setChapterId("");
              }}
              disabled={!classId}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 disabled:opacity-40"
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Book</span>
            <select
              value={bookId}
              onChange={(e) => {
                setBookId(e.target.value);
                setChapterId("");
              }}
              disabled={!subjectId}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 disabled:opacity-40"
            >
              <option value="">Select book…</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chapter</span>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              disabled={!bookId}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 disabled:opacity-40"
            >
              <option value="">Select chapter…</option>
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  Ch {ch.chapter_number}: {ch.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex rounded-xl border border-gray-200 p-0.5">
            <button
              type="button"
              onClick={() => setMode("existing")}
              disabled={!chapterId || topicsInChapter.length === 0}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                mode === "existing" ? "bg-indigo-600 text-white" : "text-gray-600"
              } disabled:opacity-40`}
            >
              Existing topic
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              disabled={!chapterId}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                mode === "new" ? "bg-indigo-600 text-white" : "text-gray-600"
              } disabled:opacity-40`}
            >
              New topic
            </button>
          </div>

          {mode === "existing" ? (
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Topic</span>
              <select
                value={existingTopicId}
                onChange={(e) => setExistingTopicId(e.target.value)}
                disabled={!chapterId || topicsInChapter.length === 0}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 disabled:opacity-40"
              >
                <option value="">Select topic…</option>
                {topicsInChapter.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New topic title</span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                placeholder="e.g. Introduction to fractions"
              />
            </label>
          )}

          <p className="text-[11px] text-gray-400">
            Notes from the left panel are saved into the topic&apos;s content field. Theme:{" "}
            <span className="font-medium text-gray-600">{slideThemeId}</span>
          </p>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !chapterId || (mode === "existing" && !existingTopicId)}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
