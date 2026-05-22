import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import libraryService from "../../services/libraryService";
import teacherService from "../../services/teacherService";
import adminService from "../../services/adminService";
import managerService from "../../services/managerService";
import { XMarkIcon } from "@heroicons/react/24/outline";

export function CreateChapterModal({
  open,
  onClose,
  onChapterCreated,
  boards = [],
  preselectedBookId = null,
  user = null,
  teacherSpecific = false,
}) {
  const [saving, setSaving] = useState(false);
  const [boardId, setBoardId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState(preselectedBookId || "");
  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");

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

  if (!open) return null;

  const handleCreate = async () => {
    if (!bookId) {
      toast.error("Select a book first");
      return;
    }
    if (!chapterNumber.trim()) {
      toast.error("Enter a chapter number");
      return;
    }
    if (!chapterTitle.trim()) {
      toast.error("Enter a chapter title");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        chapter_number: parseInt(chapterNumber, 10),
        title: chapterTitle.trim(),
      };

      let res;
      // Route to correct endpoint based on user role
      if (user?.role === "super_admin" || user?.role === "admin") {
        res = await adminService.addChapter(bookId, payload);
      } else if (user?.role === "manager") {
        res = await managerService.addChapter(bookId, payload);
      } else {
        // Teacher creates own chapter
        res = await teacherService.createChapter(bookId, payload);
      }

      const newChapter = res.data?.data ?? res.data;
      if (!newChapter?.id) throw new Error("No chapter id returned");

      toast.success("Chapter created successfully");
      onChapterCreated?.(newChapter);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Failed to create chapter");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Create New Chapter</h2>
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
              onChange={(e) => setBookId(e.target.value)}
              disabled={!subjectId}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 disabled:opacity-40"
            >
              <option value="">Select book…</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </label>

          {/* Chapter Number */}
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chapter Number</span>
            <input
              type="number"
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
              placeholder="e.g. 1, 2, 3..."
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
            />
          </label>

          {/* Chapter Title */}
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chapter Title</span>
            <input
              type="text"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="e.g. Introduction to Mathematics"
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
            disabled={saving || !bookId || !chapterNumber.trim() || !chapterTitle.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Chapter"}
          </button>
        </div>
      </div>
    </div>
  );
}
