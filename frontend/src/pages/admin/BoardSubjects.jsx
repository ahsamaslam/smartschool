import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import libraryService from "../../services/libraryService";
import { PageSpinner } from "../../components/common/Spinner";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import toast from "react-hot-toast";
import {
  BookOpenIcon,
  PlusIcon,
  TrashIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

export default function BoardSubjects() {
  const { boardId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [board, setBoard] = useState(
    location.state?.board || null
  );
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectBooks, setSubjectBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [boardsRes, subjectsRes] = await Promise.all([
        libraryService.getBoards(),
        libraryService.getBoardSubjects(boardId),
      ]);
      const boards = boardsRes?.data?.data || boardsRes?.data || [];
      const found = Array.isArray(boards)
        ? boards.find((b) => b.id === boardId)
        : null;
      if (found) setBoard(found);

      const linked = subjectsRes?.data?.data || subjectsRes?.data || [];
      setSubjects(Array.isArray(linked) ? linked : []);
    } catch {
      toast.error("Failed to load board subjects.");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const handleCreate = async (e) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) return toast.error("Subject name is required.");
    setSaving(true);
    try {
      // Always fetch all subjects first to check if it already exists
      const allRes = await libraryService.getAllSubjects();
      const all = allRes?.data?.data || allRes?.data || [];
      const trimmedName = subjectForm.name.trim().toLowerCase();
      let existing = all.find((s) => s.name.toLowerCase() === trimmedName);

      if (!existing) {
        // Subject doesn't exist yet — create it
        await libraryService.createSubject({
          name: subjectForm.name.trim(),
          description: subjectForm.description.trim() || null,
        });
        // Re-fetch to get the new subject's id
        const refetch = await libraryService.getAllSubjects();
        const refetchAll = refetch?.data?.data || refetch?.data || [];
        existing = refetchAll.find((s) => s.name.toLowerCase() === trimmedName);
      }

      if (existing) {
        // Link it to this board (merge with already-linked subjects)
        const currentIds = subjects.map((s) => s.id);
        if (!currentIds.includes(existing.id)) {
          await libraryService.setBoardSubjects(boardId, {
            subject_ids: [...currentIds, existing.id],
          });
        } else {
          toast("This subject is already linked to this board.");
          setShowCreateModal(false);
          return;
        }
      }

      toast.success(`"${subjectForm.name.trim()}" linked to ${board?.name || "board"}.`);
      setSubjectForm({ name: "", description: "" });
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add subject.");
    } finally {
      setSaving(false);
    }
  };


  const handleUnlink = async (subject) => {
    try {
      const remaining = subjects.filter((s) => s.id !== subject.id).map((s) => s.id);
      await libraryService.setBoardSubjects(boardId, { subject_ids: remaining });
      toast.success(`"${subject.name}" removed from board.`);
      loadData();
    } catch {
      toast.error("Failed to remove subject.");
    }
  };


  const filtered = subjects.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const openSubjectBooks = async (subject) => {
    setSelectedSubject(subject);
    setBooksLoading(true);
    try {
      const res = await libraryService.getBoardSubjectBooks(boardId, subject.id);
      const rows = res?.data?.data || [];
      setSubjectBooks(Array.isArray(rows) ? rows : []);
    } catch {
      toast.error("Failed to load books for this subject.");
      setSubjectBooks([]);
    } finally {
      setBooksLoading(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6 flex-wrap">
        <Link to="/admin/library" className="hover:text-gray-700 transition-colors">
          Library
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-semibold text-gray-900">{board?.name || "Board"}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <BookOpenIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{board?.name || "Board"}</h1>
            {board?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{board.description}</p>
            )}
            <p className="text-sm text-gray-400 mt-0.5">
              {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setSubjectForm({ name: "", description: "" }); setShowCreateModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex-shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          Add Subject
        </button>
      </div>

      {/* Search */}
      {subjects.length > 4 && (
        <div className="relative mb-5 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search subjects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      )}

      {/* Subjects Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <BookOpenIcon className="h-14 w-14 mb-4 opacity-20" />
          <p className="text-sm font-medium text-gray-500">
            {subjects.length === 0
              ? "No subjects linked to this board yet."
              : "No subjects match your search."}
          </p>
          {subjects.length === 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-sm text-indigo-600 hover:underline"
            >
              Add the first subject →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((subject) => (
            <div
              key={subject.id}
              className={`bg-white rounded-2xl border p-5 hover:border-indigo-200 hover:shadow-sm transition-all group cursor-pointer ${
                selectedSubject?.id === subject.id ? "border-indigo-300 ring-2 ring-indigo-100" : "border-gray-200"
              }`}
              onClick={() => openSubjectBooks(subject)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <BookOpenIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{subject.name}</p>
                  {subject.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                      {subject.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleUnlink(subject)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="Remove from board"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSubject && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">
              {selectedSubject.name} - Books
            </h2>
            <span className="text-xs text-gray-500">
              {subjectBooks.length} book{subjectBooks.length !== 1 ? "s" : ""}
            </span>
          </div>

          {booksLoading ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
              Loading books...
            </div>
          ) : subjectBooks.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
              No books saved under this board and subject yet. Parse and save a book from AI Parser.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectBooks.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() =>
                    navigate(`/admin/library/books/${book.id}`, {
                      state: {
                        boardId,
                        boardName: board?.name,
                        subjectName: selectedSubject?.name,
                      },
                    })
                  }
                  className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-12 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                      <BookOpenIcon className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-700 transition-colors">{book.title}</p>
                      {book.author && (
                        <p className="text-xs text-gray-500 mt-1">By {book.author}</p>
                      )}
                      <p className="text-xs text-indigo-600 mt-1.5">
                        {book.chapter_count || 0} chapters · {book.topic_count || 0} topics →
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Subject Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={`Add Subject — ${board?.name || "Board"}`}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Subject Name *"
            value={subjectForm.name}
            onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g., Biology, Computer Science, Urdu"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={subjectForm.description}
              onChange={(e) => setSubjectForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description"
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              fullWidth
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} fullWidth>
              Add Subject
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
