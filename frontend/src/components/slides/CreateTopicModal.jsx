import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import libraryService from "../../services/libraryService";
import teacherService from "../../services/teacherService";
import { XMarkIcon } from "@heroicons/react/24/outline";

export function CreateTopicModal({
  open,
  onClose,
  onTopicCreated,
  boards = [],
  bookDetailsCache = {},
  preselectedChapterId = null,
  user = null,
  teacherSpecific = false,
}) {
  const [saving, setSaving] = useState(false);
  const [boardId, setBoardId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState("");
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState(preselectedChapterId || "");
  const [topicName, setTopicName] = useState("");

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

  // Load books when subject changes
  useEffect(() => {
    if (!open || !boardId || !subjectId) {
      setBooks([]);
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
  }, [open, boardId, subjectId]);

  // Load chapters when book changes
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

  if (!open) return null;

  const handleCreate = async () => {
    if (!chapterId) {
      toast.error("Select a chapter first");
      return;
    }
    if (!topicName.trim()) {
      toast.error("Enter a topic name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: topicName.trim(),
        content_body: "",
      };
      // Use teacher service for teacher-scoped topic creation
      const res = await teacherService.createMyTopic(chapterId, payload);
      const newTopic = res.data?.data ?? res.data;
      if (!newTopic?.id) throw new Error("No topic id returned");

      toast.success("Topic created successfully");
      onTopicCreated?.(newTopic);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Failed to create topic");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Create New Topic</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
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

          {/* Topic Name */}
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Topic Name</span>
            <input
              type="text"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="e.g. Introduction to fractions"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
            />
          </label>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || !chapterId || !topicName.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Topic"}
          </button>
        </div>
      </div>
    </div>
  );
}
