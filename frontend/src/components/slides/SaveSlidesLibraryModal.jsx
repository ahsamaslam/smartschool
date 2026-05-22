import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import libraryService from "../../services/libraryService";
import teacherService from "../../services/teacherService";
import { XMarkIcon } from "@heroicons/react/24/outline";

function stripSlideIds(slides) {
  return slides.map(({ id: _omit, ...rest }) => ({ ...rest }));
}

/**
 * Modal: choose Library board → subject → book → chapter, then save deck to new or existing topic.
 */
export function SaveSlidesLibraryModal({
  open,
  onClose,
  slides,
  slideThemeId,
  lessonNotes,
  suggestedTitle,
  /** { board, subject, book, chapter } when arriving from Library */
  initialContext,
  /** Library topic UUID when updating in place */
  existingLibraryTopicId,
  /** topic row from Library navigation (includes id, chapter_id if present) */
  topicHint,
  onComplete,
  /** "teacher" | "admin" | "super_admin" — controls which save path is used */
  userRole,
}) {
  const [saving, setSaving] = useState(false);

  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState("");
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

  // Load boards when modal opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await libraryService.getBoards();
        const list = res.data?.data ?? res.data ?? [];
        setBoards(Array.isArray(list) ? list : []);
      } catch {
        toast.error("Could not load boards");
      }
    })();
  }, [open]);

  // Load subjects when board changes
  useEffect(() => {
    if (!open || !boardId) {
      setSubjects([]);
      return;
    }
    (async () => {
      try {
        const res = await libraryService.getBoardSubjects(boardId);
        const list = res.data?.data ?? res.data ?? [];
        setSubjects(Array.isArray(list) ? list : []);
      } catch {
        toast.error("Could not load subjects");
      }
    })();
  }, [open, boardId]);

  // Load books when board+subject set
  useEffect(() => {
    if (!open || !boardId || !subjectId) {
      // Don't clear books if we have a pre-set bookId from initialContext
      if (!bookId) setBooks([]);
      return;
    }
    (async () => {
      try {
        const res = await libraryService.getBoardSubjectBooks(boardId, subjectId);
        const list = res.data?.data ?? res.data ?? [];
        setBooks(Array.isArray(list) ? list : []);
      } catch {
        toast.error("Could not load books");
      }
    })();
  }, [open, boardId, subjectId]); // eslint-disable-line

  // Load chapters when book is set
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

  // Pre-fill from initialContext (e.g. arriving from BookDetail)
  useEffect(() => {
    if (!open) return;
    const ctx = initialContext;
    setBoardId(ctx?.board?.id || "");
    setSubjectId(ctx?.subject?.id || "");
    setBookId(ctx?.book?.id || "");
    setChapterId(ctx?.chapter?.id || "");

    const tid = existingLibraryTopicId || topicHint?.id || "";
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

    const payloadSlides = stripSlideIds(slides);
    const bodyNotes = lessonNotes || "";

    // ── Personal save path: all roles save to their own isolated row ──
    if (userRole) {
      const targetTopicId = existingLibraryTopicId || topicHint?.id;
      if (!targetTopicId) {
        toast.error("Open a topic from My Curriculum first, then save slides.");
        return;
      }
      setSaving(true);
      try {
        console.log("Saving slides with theme:", slideThemeId);
        await teacherService.saveMyTopicSlides(targetTopicId, {
          slides: payloadSlides,
          slide_theme: slideThemeId,
          content_body: bodyNotes,
        });
        toast.success("Slides saved — only visible to you.", { duration: 4500 });
        onComplete?.({ bookId, chapterId, topicId: targetTopicId });
        onClose();
      } catch (err) {
        toast.error(err?.response?.data?.detail || err?.message || "Save failed");
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── Admin / super_admin path: save to shared library topic ──
    if (!chapterId) {
      toast.error("Pick a chapter first");
      return;
    }
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
        toast.success("Slides saved to library topic.", { duration: 4500 });
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
        toast.success("Created library topic with slides.", { duration: 4500 });
        onComplete?.({ bookId, chapterId, topicId: newId });
      }
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Whether book is pre-set from navigation (skip board/subject selection)
  const bookPreset = !!initialContext?.book?.id;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Save slides</h2>
            <p className="text-xs text-gray-500">
              {userRole ? "Saved privately — only you can see these slides" : "Board → Subject → Book → Chapter → Topic"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Personal save view — topic already known */}
        {userRole && (existingLibraryTopicId || topicHint?.id) && (
          <div className="px-5 py-5">
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-1">Saving to topic</p>
              <p className="text-base font-semibold text-indigo-900">{topicHint?.title || "Selected topic"}</p>
              <p className="text-xs text-gray-500 mt-1">
                These slides are stored under your account only. Other teachers using the same topic will not see them.
              </p>
            </div>
          </div>
        )}

        {/* No topic selected */}
        {userRole && !(existingLibraryTopicId || topicHint?.id) && (
          <div className="px-5 py-5">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 text-sm text-amber-900">
              No topic selected. Go to <strong>My Curriculum</strong>, open a topic, then click <strong>Slides</strong> to create slides linked to that topic.
            </div>
          </div>
        )}

        <div className={`px-5 py-4 space-y-3 text-sm ${userRole ? "hidden" : ""}`}>
          {bookPreset ? (
            /* Book pre-set from navigation — show as read-only pill */
            <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Book</p>
                <p className="text-sm font-medium text-indigo-800 mt-0.5">
                  {initialContext.book?.title || "Selected book"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBoardId(""); setSubjectId(""); setBookId(""); setChapterId("");
                }}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              {/* Board */}
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Board</span>
                <select
                  value={boardId}
                  onChange={(e) => {
                    setBoardId(e.target.value);
                    setSubjectId("");
                    setBookId("");
                    setChapterId("");
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                >
                  <option value="">Select board…</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>

              {/* Subject */}
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</span>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setBookId("");
                    setChapterId("");
                  }}
                  disabled={!boardId}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 disabled:opacity-40"
                >
                  <option value="">Select subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>

              {/* Book */}
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
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          {/* Chapter */}
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

          {/* Existing / New topic toggle */}
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
                  <option key={t.id} value={t.id}>{t.title}</option>
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
            disabled={
              saving ||
              (userRole
                ? !(existingLibraryTopicId || topicHint?.id)
                : !chapterId || (mode === "existing" && !existingTopicId))
            }
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
