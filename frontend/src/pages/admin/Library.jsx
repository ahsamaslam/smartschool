import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { PageSpinner } from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import Dropdown from "../../components/common/Dropdown";
import toast from "react-hot-toast";
import adminService from "../../services/adminService";
import libraryService from "../../services/libraryService";
import { libraryTopicHasSlides, parseLibraryTopicSlidesJson } from "../../utils/libraryTopicSlides";
import {
  libraryTopicPresentPath,
  openLibraryTopicPresentNewTab,
  resolveLibraryTopicIdFromRow,
} from "../../utils/libraryNavigation";
import { SlideRenderer } from "../../components/slides/SlideRenderer";
import { SLIDE_TEMPLATES, SLIDE_ANIMATIONS } from "../../data/slideTemplates";
import {
  BookOpenIcon,
  AcademicCapIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  SparklesIcon,
  TrashIcon,
  PencilSquareIcon,
  HomeIcon,
  PresentationChartBarIcon,
  FilmIcon,
  ChevronLeftIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";

/** New tab must open synchronously (no await); fall back to same-tab route if blocked. */
function openLibraryPresentNewTabWithFallback(topicLike, navigate) {
  const tid = resolveLibraryTopicIdFromRow(topicLike);
  if (!tid) {
    toast.error("Missing topic ID. Reload the book in the Library and try again.");
    return;
  }
  openLibraryTopicPresentNewTab(tid, {
    onBlocked: () => {
      toast.error("Pop-up blocked — opening presenter in this tab.");
      navigate(libraryTopicPresentPath(tid));
    },
  });
}

function openRecordLectureNewTabWithFallback(topicLike, navigate) {
  const tid = resolveLibraryTopicIdFromRow(topicLike);
  if (!tid) {
    toast.error("Missing topic ID. Reload and try again.");
    return;
  }
  const w = window.open(`/admin/record-lecture/${tid}`, "_blank");
  if (!w) {
    toast.error("Pop-up blocked — opening recorder in this tab.");
    navigate(`/admin/record-lecture/${encodeURIComponent(tid)}`);
    return;
  }
  try {
    w.focus();
  } catch {
    /* ignore */
  }
}

// ============================================
// BREADCRUMB NAVIGATION
// ============================================

function Breadcrumb({ items, onNavigate }) {
  return (
    <div className="flex items-center gap-2 text-sm mb-6">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {idx > 0 && <ChevronRightIcon className="h-3.5 w-3.5 text-gray-300" />}
          <button
            onClick={() => onNavigate(item.level, item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              idx === items.length - 1
                ? "bg-indigo-50 text-indigo-700 font-semibold"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            }`}
          >
            {item.icon && <item.icon className="h-4 w-4" />}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================
// VIEW 1: CLASSES
// ============================================

const CLASS_PRESETS = [
  "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6",
  "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12",
  "O-Level 1st Year", "O-Level 2nd Year",
  "A-Level 1st Year", "A-Level 2nd Year",
];

function ManageBoardsModal({ isOpen, onClose }) {
  const [boards, setBoards] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingBoard, setSavingBoard] = useState(false);
  const [activeBoardId, setActiveBoardId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [boardsRes, subjectsRes] = await Promise.all([
        libraryService.getBoards(),
        libraryService.getAllSubjects(),
      ]);
      const boardsData = boardsRes?.data?.data || [];
      const subjectsData = subjectsRes?.data?.data || [];
      setBoards(boardsData);
      setSubjects(subjectsData);
      const first = boardsData[0]?.id || "";
      setActiveBoardId(first);
    } catch {
      toast.error("Failed to load boards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!activeBoardId) {
      setSelectedSubjectIds([]);
      return;
    }
    libraryService
      .getBoardSubjects(activeBoardId)
      .then((res) => {
        const data = res?.data?.data || [];
        setSelectedSubjectIds(data.map((s) => s.id));
      })
      .catch(() => setSelectedSubjectIds([]));
  }, [activeBoardId]);

  const createBoard = async () => {
    if (!boardName.trim()) return toast.error("Board name required.");
    setSavingBoard(true);
    try {
      await libraryService.createBoard({
        name: boardName.trim(),
        description: boardDescription.trim() || null,
      });
      toast.success("Board created.");
      setBoardName("");
      setBoardDescription("");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create board.");
    } finally {
      setSavingBoard(false);
    }
  };

  const saveSubjects = async () => {
    if (!activeBoardId) return;
    try {
      await libraryService.setBoardSubjects(activeBoardId, {
        subject_ids: selectedSubjectIds,
      });
      toast.success("Board subjects updated.");
      await load();
      setActiveBoardId(activeBoardId);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update board subjects.");
    }
  };

  const deleteBoard = async (boardId) => {
    if (!window.confirm("Delete this board?")) return;
    try {
      await libraryService.deleteBoard(boardId);
      toast.success("Board deleted.");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete board.");
    }
  };

  const toggleSubject = (subjectId) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Boards">
      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <input
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="Board name (e.g. Punjab Board)"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={createBoard}
              disabled={savingBoard}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              Add Board
            </button>
          </div>
          <input
            value={boardDescription}
            onChange={(e) => setBoardDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="space-y-2">
            {boards.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">No boards yet.</div>
            ) : (
              boards.map((board) => (
                <div key={board.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveBoardId(board.id)}
                    className={`flex-1 text-left px-3 py-2 rounded-xl border text-sm ${
                      activeBoardId === board.id
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {board.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteBoard(board.id)}
                    className="px-2.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    title="Delete board"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {activeBoardId && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Subjects in selected board</p>
              <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                {subjects.map((subject) => (
                  <label key={subject.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.includes(subject.id)}
                      onChange={() => toggleSubject(subject.id)}
                    />
                    <span className="text-sm text-gray-800">{subject.name}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={saveSubjects}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
              >
                Save Board Subjects
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ClassesView({ onSelectClass }) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [boards, setBoards] = useState([]);
  const [boardSubjects, setBoardSubjects] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showAddBoardModal, setShowAddBoardModal] = useState(false);
  const [showDeleteBoardModal, setShowDeleteBoardModal] = useState(null);
  const [classForm, setClassForm] = useState({ preset: "", custom: "" });
  const [boardForm, setBoardForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      const [classRes, boardRes] = await Promise.all([
        libraryService.getLibraryClasses(),
        libraryService.getBoards(),
      ]);
      const classesData = Array.isArray(classRes.data) ? classRes.data : (classRes.data?.data || []);
      const boardsData = Array.isArray(boardRes.data) ? boardRes.data : (boardRes.data?.data || []);
      setClasses(classesData);
      setBoards(boardsData);
    } catch (err) {
      console.error("Failed to load library classes:", err);
      setError(err.message);
      toast.error("Failed to load library data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const handleDeleteClass = async () => {
    if (!showDeleteModal) return;
    setDeleting(true);
    try {
      await libraryService.deleteLibraryClass(showDeleteModal.id);
      toast.success(`${showDeleteModal.name} deleted`);
      setShowDeleteModal(null);
      loadClasses();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete class");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteBoard = async () => {
    if (!showDeleteBoardModal) return;
    setDeleting(true);
    try {
      await libraryService.deleteBoard(showDeleteBoardModal.id);
      toast.success(`${showDeleteBoardModal.name} deleted`);
      setShowDeleteBoardModal(null);
      loadClasses();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete board");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    const name = classForm.preset === "__custom__" ? classForm.custom.trim() : classForm.preset;
    if (!name) { toast.error("Please select or enter a class name"); return; }
    setSaving(true);
    try {
      await libraryService.createLibraryClass({ name });
      toast.success(`${name} added`);
      setShowAddModal(false);
      setClassForm({ preset: "", custom: "" });
      loadClasses();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add class");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBoard = async (e) => {
    e.preventDefault();
    if (!boardForm.name.trim()) {
      toast.error("Board name is required");
      return;
    }
    setSaving(true);
    try {
      await libraryService.createBoard({
        name: boardForm.name.trim(),
        description: boardForm.description.trim() || null,
      });
      toast.success(`${boardForm.name} added`);
      setShowAddBoardModal(false);
      setBoardForm({ name: "", description: "" });
      loadClasses();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add board");
    } finally {
      setSaving(false);
    }
  };


  if (loading) return <PageSpinner />;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-semibold">Error loading classes</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Curriculum Library</h2>
          <p className="text-sm text-gray-500 mt-1">Board-first flow: Board → Subjects</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={() => setShowAddBoardModal(true)}
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Add Board
          </Button>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900">Boards</h3>
          <p className="text-xs text-gray-500">Board → Subject hierarchy</p>
        </div>
        {boards.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
            <BookOpenIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">No boards found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {boards.map((board) => (
              <div
                key={board.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-emerald-300 transition-all group cursor-pointer"
                onClick={() => navigate(`/admin/library/boards/${board.id}`, { state: { board } })}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <BookOpenIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 leading-tight">{board.name}</h3>
                    {board.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{board.description}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDeleteBoardModal(board); }}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span>{board.subject_count || 0} subject{Number(board.subject_count || 0) !== 1 ? "s" : ""}</span>
                  <span className="text-indigo-400 font-medium group-hover:text-indigo-600 transition-colors">View →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      <Modal isOpen={showAddBoardModal} onClose={() => setShowAddBoardModal(false)} title="Add Board">
        <form onSubmit={handleAddBoard} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Board Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={boardForm.name}
              onChange={(e) => setBoardForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Punjab Board, Oxford, O-Level"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={boardForm.description}
              onChange={(e) => setBoardForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description of this board"
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowAddBoardModal(false)} fullWidth>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} fullWidth>
              Add Board
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!showDeleteBoardModal} onClose={() => !deleting && setShowDeleteBoardModal(null)} title="Delete Board">
        {showDeleteBoardModal && (
          <div className="space-y-4">
            <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">This cannot be undone.</p>
              <p>Deleting <strong>"{showDeleteBoardModal.name}"</strong> will remove its subject mappings and section links.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteBoardModal(null)} disabled={deleting} fullWidth>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteBoard} loading={deleting} fullWidth>
                Delete Board
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

// ============================================
// VIEW 2: SUBJECTS FOR CLASS
// ============================================

function SubjectsView({ classData, onSelectSubject, onBack }) {
  const { user } = useAuth();
  const userRole = user?.role || "";
  const userId = user?.id || "";
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [subjectForm, setSubjectForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDeleteSubject = (subject) => {
    if (userRole === "super_admin") return !subject.tenant_id;
    if (userRole === "admin")
      return subject.origin_role === "admin" && !subject.source_id && !subject.manager_id;
    if (userRole === "manager") return subject.manager_id === userId;
    return false;
  };

  const loadData = useCallback(async () => {
    if (!classData?.id) return;
    try {
      const res = await libraryService.getClassSubjects(classData.id);
      const subjectsData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      console.log("Subjects for class:", subjectsData);
      setSubjects(subjectsData);
    } catch (err) {
      console.error("Failed to load subjects:", err);
      toast.error("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  }, [classData?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteSubject = async () => {
    if (!showDeleteModal) return;
    setDeleting(true);
    try {
      await libraryService.removeSubjectFromClass(classData.id, showDeleteModal.id);
      toast.success(`${showDeleteModal.name} removed from ${classData.name}`);
      setShowDeleteModal(null);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to remove subject");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) {
      toast.error("Subject name is required");
      return;
    }
    
    setSaving(true);
    try {
      await libraryService.addSubjectToClass(classData.id, {
        name: subjectForm.name,
        description: subjectForm.description,
      });
      toast.success(`${subjectForm.name} added to ${classData.name}`);
      setShowAddModal(false);
      setSubjectForm({ name: "", description: "" });
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add subject");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {classData.name} - Subjects
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Select a subject to view books
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          Add Subject
        </Button>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-xl">
          <BookOpenIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-sm font-medium">No subjects added yet for {classData.name}</p>
          <p className="text-xs mt-1">Add subjects like English, Math, Science, Computer Science</p>
          <Button
            variant="primary"
            onClick={() => setShowAddModal(true)}
            className="mt-4"
          >
            <PlusIcon className="h-4 w-4 inline mr-2" />
            Add Your First Subject
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => onSelectSubject(subject)}
            >
              <div className="flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    <BookOpenIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                      {subject.name}
                    </h3>
                    {subject.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                        {subject.description}
                      </p>
                    )}
                  </div>
                  {canDeleteSubject(subject) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteModal(subject); }}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span>{subject.book_count || 0} book{subject.book_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Subject Modal */}
      <Modal isOpen={!!showDeleteModal} onClose={() => !deleting && setShowDeleteModal(null)} title="Remove Subject">
        {showDeleteModal && (
          <div className="space-y-4">
            <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">This cannot be undone.</p>
              <p>Removing <strong>"{showDeleteModal.name}"</strong> from <strong>{classData.name}</strong> will also delete all books under it for this class.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteModal(null)} disabled={deleting} fullWidth>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteSubject} loading={deleting} fullWidth>Remove Subject</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Subject Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Subject"
      >
        <form onSubmit={handleAddSubject} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subjectForm.name}
              onChange={(e) =>
                setSubjectForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g., Computer Science, English, Urdu, Math"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={subjectForm.description}
              onChange={(e) =>
                setSubjectForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Brief description of the subject"
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
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

// ============================================
// VIEW 3: BOOKS FOR CLASS-SUBJECT
// ============================================

function BooksView({ classData, subjectData, onSelectBook, onBack }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role || "";
  const userId = user?.id || "";
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);

  const canDeleteBook = (book) => {
    if (userRole === "super_admin") return !book.tenant_id;
    if (userRole === "admin")
      return book.tenant_id && !book.source_id && !book.manager_id;
    if (userRole === "manager") return book.manager_id === userId;
    return false;
  };
  const [pdfTab, setPdfTab] = useState("url"); // "url" | "upload"
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [bookForm, setBookForm] = useState({
    title: "", author: "", board_name: "", edition_year: "", pdf_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pdfInputRef = useRef(null);

  const loadBooks = useCallback(async () => {
    try {
      const res = await libraryService.getBooks(classData.id, subjectData.id);
      const booksData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setBooks(booksData);
    } catch {
      toast.error("Failed to load books");
    } finally {
      setLoading(false);
    }
  }, [classData.id, subjectData.id]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleCreateBook = async (e) => {
    e.preventDefault();
    if (!bookForm.title.trim()) {
      toast.error("Book title is required");
      return;
    }
    setSaving(true);
    try {
      let pdf_url = bookForm.pdf_url;

      // If user chose to upload a PDF file, upload it first
      if (pdfTab === "upload" && pdfFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("file", pdfFile);
        const upRes = await libraryService.uploadBookPdf(fd);
        pdf_url = upRes.data?.url || "";
        setUploading(false);
      }

      await libraryService.createBook({
        class_id: classData.id,
        subject_id: subjectData.id,
        ...bookForm,
        pdf_url,
        edition_year: bookForm.edition_year ? parseInt(bookForm.edition_year) : null,
      });
      toast.success("Book created successfully");
      setShowAddModal(false);
      setBookForm({ title: "", author: "", board_name: "", edition_year: "", pdf_url: "" });
      setPdfFile(null);
      setPdfTab("url");
      loadBooks();
    } catch (err) {
      setUploading(false);
      toast.error(err?.response?.data?.detail || "Failed to create book");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!showDeleteModal) return;
    setDeleting(true);
    try {
      await libraryService.deleteBook(showDeleteModal.id);
      toast.success("Book deleted successfully");
      setShowDeleteModal(null);
      loadBooks();
    } catch {
      toast.error("Failed to delete book");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{subjectData.name} - Books</h2>
          <p className="text-sm text-gray-500 mt-1">
            {classData.name}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          Add Book
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {books.map((book) => (
          <div
            key={book.id}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-amber-300 hover:shadow-md transition-all group cursor-pointer"
            onClick={() => onSelectBook(book)}
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-16 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                <DocumentTextIcon className="h-7 w-7 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 group-hover:text-amber-700 transition-colors leading-snug">
                  {book.title || <span className="text-gray-400 italic font-normal">Untitled Book</span>}
                </h3>
                {book.author && (
                  <p className="text-xs text-gray-500 mt-1">By {book.author}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {book.board_name && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {book.board_name}
                    </span>
                  )}
                  {book.edition_year && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {book.edition_year}
                    </span>
                  )}
                  {book.pdf_url?.startsWith("/static/") && (
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">PDF</span>
                  )}
                  {book.pdf_url?.startsWith("http") && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Link</span>
                  )}
                </div>
              </div>
              {canDeleteBook(book) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteModal(book); }}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {books.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <DocumentTextIcon className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-sm font-medium">No books added yet</p>
          <div className="flex gap-3 justify-center mt-4">
            <Button
              variant="secondary"
              onClick={() => setShowAddModal(true)}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Manually
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate("/admin/ai-parser")}
            >
              <SparklesIcon className="h-4 w-4 mr-2" />
              Use AI Parser
            </Button>
          </div>
        </div>
      )}

      {/* Add Book Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Book">
        <form onSubmit={handleCreateBook} className="space-y-4">
          <Input
            label="Book Title *"
            value={bookForm.title}
            onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))}
            required
            placeholder="e.g., Computer Science Textbook"
          />
          <Input
            label="Author"
            value={bookForm.author}
            onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))}
            placeholder="e.g., John Smith"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Board Name"
              value={bookForm.board_name}
              onChange={(e) => setBookForm((f) => ({ ...f, board_name: e.target.value }))}
              placeholder="e.g., Cambridge"
            />
            <Input
              label="Edition Year"
              type="number"
              value={bookForm.edition_year}
              onChange={(e) => setBookForm((f) => ({ ...f, edition_year: e.target.value }))}
              placeholder="e.g., 2024"
            />
          </div>

          {/* PDF — URL or Upload tabs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">PDF (optional)</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-3">
              <button
                type="button"
                onClick={() => setPdfTab("url")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  pdfTab === "url" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                Enter URL
              </button>
              <button
                type="button"
                onClick={() => setPdfTab("upload")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  pdfTab === "upload" ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                Upload PDF
              </button>
            </div>

            {pdfTab === "url" ? (
              <input
                type="url"
                value={bookForm.pdf_url}
                onChange={(e) => setBookForm((f) => ({ ...f, pdf_url: e.target.value }))}
                placeholder="https://example.com/book.pdf"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <div
                onClick={() => pdfInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                  pdfFile ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                }`}
              >
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                />
                {pdfFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700 truncate max-w-xs">
                      {pdfFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPdfFile(null); }}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-8 w-8 text-gray-300 mx-auto mb-1" />
                    <p className="text-sm text-gray-500">Click to select a PDF file</p>
                    <p className="text-xs text-gray-400 mt-0.5">Max 100 MB</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} fullWidth>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving || uploading} fullWidth>
              {uploading ? "Uploading PDF…" : "Create Book"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteModal}
        onClose={() => !deleting && setShowDeleteModal(null)}
        title="Delete Book"
      >
        {showDeleteModal && (
          <div className="space-y-4">
            <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">This cannot be undone.</p>
              <p>
                Deleting <strong>"{showDeleteModal.title}"</strong> will permanently remove
                the book and all its chapters and topics.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteModal(null)}
                disabled={deleting}
                fullWidth
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteBook}
                loading={deleting}
                fullWidth
              >
                Delete Book
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Resolve relative /static/... paths to full backend URL
function resolvePdfUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace("/api", "");
  return `${base}${url}`;
}

// ============================================
// VIEW 4: CHAPTERS & TOPICS FOR BOOK
// ============================================

function ChapterTopicsView({ book, onBack, onSelectTopic }) {
  const navigate = useNavigate();
  const [bookData, setBookData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState({});

  useEffect(() => {
    const loadBookDetails = async () => {
      try {
        const res = await libraryService.getBookDetails(book.id);
        const bookData = res.data?.data ?? res.data;
        setBookData(bookData);
        // Auto-expand all chapters
        const expanded = {};
        (bookData.chapters || []).forEach((ch) => {
          expanded[ch.id] = true;
        });
        setExpandedChapters(expanded);
      } catch {
        toast.error("Failed to load book details");
      } finally {
        setLoading(false);
      }
    };
    loadBookDetails();
  }, [book.id]);

  const toggleChapter = (chapterId) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  if (loading) return <PageSpinner />;
  if (!bookData) return null;

  const hasPdf = !!bookData.pdf_url;
  const hasChapters = bookData.chapters?.length > 0;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-xl font-bold text-gray-900">{bookData.title}</h2>
          {bookData.author && (
            <p className="text-sm text-gray-500 mt-1">By {bookData.author}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {bookData.board_name && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                {bookData.board_name}
              </span>
            )}
            {bookData.edition_year && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                {bookData.edition_year}
              </span>
            )}
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
              {(bookData.chapters || []).length} chapters
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {(bookData.chapters || []).map((chapter) => {
            const isExpanded = expandedChapters[chapter.id];
            return (
              <div
                key={chapter.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full flex-shrink-0">
                    Ch {chapter.chapter_number}
                  </span>
                  <span className="flex-1 font-semibold text-gray-900">
                    {chapter.title}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {(chapter.topics || []).length} topics
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/50 space-y-2">
                    {(chapter.topics || []).map((topic) => {
                      const hasSlides = libraryTopicHasSlides(topic);
                      return (
                        <div
                          key={resolveLibraryTopicIdFromRow(topic) || topic.title}
                          className="w-full flex flex-col sm:flex-row sm:items-stretch gap-2 bg-white rounded-lg border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => onSelectTopic && onSelectTopic(topic, chapter, bookData)}
                            className="flex-1 flex items-start gap-3 px-4 py-3 text-left group min-w-0"
                          >
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                              <DocumentTextIcon className="h-4 w-4 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 group-hover:text-indigo-700 transition-colors leading-snug">
                                {topic.title}
                              </p>
                              {topic.content_body && (
                                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{topic.content_body.slice(0, 100)}…</p>
                              )}
                            </div>
                            <ChevronRightIcon className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1" />
                          </button>

                          {hasSlides && (
                            <div className="flex sm:flex-col gap-2 p-3 sm:p-3 sm:border-l border-gray-100 bg-gray-50/80 sm:min-w-[9.5rem] flex-shrink-0 justify-center">
                              <button
                                type="button"
                                onClick={() => openLibraryPresentNewTabWithFallback(topic, navigate)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black cursor-pointer border-0 w-full font-inherit"
                              >
                                <PlayCircleIcon className="h-4 w-4 shrink-0" />
                                View slides
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const tid = resolveLibraryTopicIdFromRow(topic);
                                  if (!tid) {
                                    toast.error("Missing topic ID.");
                                    return;
                                  }
                                  openRecordLectureNewTabWithFallback({ id: tid }, navigate);
                                }}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50"
                              >
                                <FilmIcon className="h-4 w-4 shrink-0" />
                                Record lecture
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(!chapter.topics || chapter.topics.length === 0) && (
                      <p className="text-xs text-gray-400 py-2 text-center">
                        No topics in this chapter yet
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(!bookData.chapters || bookData.chapters.length === 0) && (() => {
          const pdfUrl = resolvePdfUrl(bookData.pdf_url);
          const isExternal = bookData.pdf_url?.startsWith("http");

          if (pdfUrl && !isExternal) {
            // Uploaded PDF — embed in iframe full width
            return (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">PDF Viewer</span>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <ArrowPathIcon className="h-3.5 w-3.5" />
                    Open in new tab
                  </a>
                </div>
                <iframe
                  src={pdfUrl}
                  className="w-full"
                  style={{ height: "75vh" }}
                  title={bookData.title}
                />
              </div>
            );
          }

          if (pdfUrl && isExternal) {
            // External URL — open in new tab
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                <DocumentTextIcon className="h-14 w-14 mx-auto mb-4 text-indigo-200" />
                <p className="font-semibold text-gray-800 mb-1">{bookData.title}</p>
                <p className="text-sm text-gray-500 mb-5">This book links to an external resource.</p>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <CloudArrowUpIcon className="h-4 w-4 rotate-180" />
                  Open Book Link
                </a>
              </div>
            );
          }

          // No PDF, no link — prompt AI Parser
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
              <BookOpenIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-700">No content yet</p>
              <p className="text-xs mt-1 mb-4 text-gray-400">
                Use the AI Parser to automatically extract chapters and topics from a PDF.
              </p>
              <Button variant="primary" onClick={() => window.location.href = "/admin/ai-parser"}>
                <SparklesIcon className="h-4 w-4 mr-2" />
                Parse with AI
              </Button>
            </div>
          );
        })()}
      </div>

    </div>
  );
}

// ============================================
// VIEW 5: TOPIC DETAIL — FULL PAGE
// ============================================

function TopicSlidesInlinePreview({ topicRow, topicId, navigate }) {
  const deck = useMemo(
    () => parseLibraryTopicSlidesJson(topicRow?.slides_json),
    [topicRow?.slides_json],
  );
  const [template, setTemplate] = useState(SLIDE_TEMPLATES[0]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [topicRow?.slides_json]);

  useEffect(() => {
    const th = topicRow?.slide_theme;
    if (th) {
      const found = SLIDE_TEMPLATES.find((t) => t.id === th);
      if (found) setTemplate(found);
    }
  }, [topicRow?.slide_theme]);

  const presentPath = topicId ? libraryTopicPresentPath(topicId) : "";

  if (!deck.length) return null;

  const slide = deck[idx];
  const anim =
    SLIDE_ANIMATIONS.find((a) => a.id === slide?.animation)?.css || "";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6 shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-gray-50/80">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <PresentationChartBarIcon className="h-5 w-5 text-indigo-600" />
          Slides
        </h2>
        <div className="flex flex-wrap gap-2">
          {presentPath && (
            <button
              type="button"
              onClick={() => navigate(presentPath)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
            >
              <PlayCircleIcon className="h-4 w-4" />
              Fullscreen
            </button>
          )}
          <button
            type="button"
            onClick={() => openLibraryPresentNewTabWithFallback({ id: topicId }, navigate)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50"
          >
            View slides
          </button>
        </div>
      </div>
      <div className="p-4 bg-gray-950">
        <div
          className={`mx-auto max-w-4xl ${anim}`}
          style={{ aspectRatio: "16/9" }}
        >
          <SlideRenderer
            slide={slide}
            template={template}
            slideIndex={idx}
          />
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 px-4 py-3 bg-gray-100 border-t border-gray-200">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="p-2 rounded-lg text-gray-600 hover:bg-white disabled:opacity-30"
          aria-label="Previous slide"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <span className="text-sm font-mono text-gray-700 min-w-[5rem] text-center">
          {idx + 1} / {deck.length}
        </span>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(deck.length - 1, i + 1))}
          disabled={idx === deck.length - 1}
          className="p-2 rounded-lg text-gray-600 hover:bg-white disabled:opacity-30"
          aria-label="Next slide"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function TopicDetailView({ topic, chapter, book, libraryContext, onCreateSlides }) {
  const navigate = useNavigate();
  const [meta, setMeta] = useState(topic);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await libraryService.getTopic(resolveLibraryTopicIdFromRow(topic), { timeout: 20000 });
        const row = res.data?.data ?? res.data;
        if (!cancel && row) setMeta(row);
      } catch {
        /* keep initial topic row */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [topic.id]);

  const topicIdRaw = resolveLibraryTopicIdFromRow({ ...topic, ...meta });

  const hasSlides = libraryTopicHasSlides(meta);
  const hasLecture = Boolean(meta?.has_lecture || meta?.lecture_video_url);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">
            {book?.title}
          </span>
          {chapter && (
            <>
              <ChevronRightIcon className="h-3.5 w-3.5 text-gray-300" />
              <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                Ch {chapter.chapter_number} — {chapter.title}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
          <h1 className="text-2xl font-bold text-gray-900 leading-snug flex-1 min-w-0">{topic.title}</h1>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onCreateSlides}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <PresentationChartBarIcon className="h-4 w-4" />
              Create Slides
            </button>
            {hasSlides && (
              <>
                <button
                  type="button"
                  disabled={!topicIdRaw}
                  onClick={() =>
                    topicIdRaw &&
                    openLibraryPresentNewTabWithFallback({ id: topicIdRaw }, navigate)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50 disabled:pointer-events-none border-0 cursor-pointer"
                >
                  <PlayCircleIcon className="h-5 w-5" />
                  View slides
                </button>
                <button
                  type="button"
                  disabled={!topicIdRaw}
                  onClick={() => topicIdRaw && navigate(libraryTopicPresentPath(topicIdRaw))}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <PresentationChartBarIcon className="h-5 w-5" />
                  Present fullscreen
                </button>
                <button
                  type="button"
                  onClick={() => openRecordLectureNewTabWithFallback({ id: topicIdRaw }, navigate)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 bg-white text-rose-700 text-sm font-semibold hover:bg-rose-50"
                >
                  <FilmIcon className="h-5 w-5" />
                  {hasLecture ? "Re-record lecture" : "Record lecture"}
                </button>
                {hasLecture && (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/topics/${topicIdRaw}/lecture`)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50"
                    >
                      <PlayCircleIcon className="h-5 w-5" />
                      Open recorded lecture
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm("Delete recorded lecture for this topic?")) return;
                        try {
                          const res = await libraryService.deleteTopicLecture(topicIdRaw);
                          const row = res?.data?.data ?? res?.data;
                          if (row?.id) setMeta(row);
                          toast.success("Lecture deleted.");
                        } catch {
                          toast.error("Failed to delete lecture.");
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 bg-white text-red-700 text-sm font-semibold hover:bg-red-50"
                    >
                      <TrashIcon className="h-5 w-5" />
                      Delete lecture
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {hasSlides && topicIdRaw && (
        <TopicSlidesInlinePreview
          topicRow={{ ...topic, ...meta }}
          topicId={topicIdRaw}
          navigate={navigate}
        />
      )}

      {/* Content */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        {topic.content_body ? (
          <div className="prose prose-base max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
            {topic.content_body}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <DocumentTextIcon className="h-14 w-14 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-gray-500">No content available for this topic</p>
            <p className="text-sm mt-1">Use the AI Parser to extract content from a PDF book.</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================
// MAIN LIBRARY PAGE WITH NAVIGATION STATE
// ============================================

export default function AdminLibrary() {
  const [view, setView] = useState("classes"); // classes | subjects | books | chapters | topic
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);

  const handleSelectClass = (gradeData) => {
    setSelectedClass(gradeData);
    setView("subjects");
  };

  const handleSelectSubject = (subject) => {
    setSelectedSubject(subject);
    setView("books");
  };

  const handleSelectBook = (book) => {
    setSelectedBook(book);
    setView("chapters");
  };

  const handleSelectTopic = (topic, chapter, book) => {
    setSelectedTopic(topic);
    setSelectedChapter(chapter);
    if (book && !selectedBook) setSelectedBook(book);
    setView("topic");
  };

  const navigate = useNavigate();
  const location = useLocation();
  const appliedFocusRef = useRef(null);

  useEffect(() => {
    const focus = location.state?.libraryFocus;
    if (!focus?.bookId) return;
    const token = `${focus.bookId}:${focus.topicId || ""}`;
    if (appliedFocusRef.current === token) return;

    (async () => {
      try {
        const res = await libraryService.getBookDetails(focus.bookId);
        const book = res.data?.data ?? res.data;
        if (!book?.id) return;

        setSelectedClass({ id: book.class_id, name: book.class_name || "Class" });
        setSelectedSubject({ id: book.subject_id, name: book.subject_name || "Subject" });
        setSelectedBook(book);

        let chapter =
          focus.chapterId && Array.isArray(book.chapters)
            ? book.chapters.find((c) => c.id === focus.chapterId) || null
            : null;
        let topic = null;
        if (focus.topicId && book.chapters) {
          for (const ch of book.chapters) {
            const t = (ch.topics || []).find((x) => x.id === focus.topicId);
            if (t) {
              topic = t;
              chapter = chapter || ch;
              break;
            }
          }
        }

        setSelectedChapter(chapter);
        setSelectedTopic(topic || (focus.topicId ? { id: focus.topicId, title: "Saved topic" } : null));
        setView(topic || focus.topicId ? "topic" : "chapters");
        appliedFocusRef.current = token;
      } catch (e) {
        console.error(e);
        toast.error("Could not open saved library location");
      } finally {
        navigate(".", { replace: true, state: { ...location.state, libraryFocus: undefined } });
      }
    })();
  }, [location.state, navigate]);

  const handleCreateSlides = () => {
    navigate("/admin/slides", {
      state: {
        topic: selectedTopic,
        libraryContext: {
          libraryClass: selectedClass,
          subject: selectedSubject,
          book: selectedBook,
          chapter: selectedChapter,
        },
      },
    });
  };

  const handleNavigate = (level) => {
    if (level === "home") {
      setView("classes");
      setSelectedClass(null);
      setSelectedSubject(null);
      setSelectedBook(null);
      setSelectedTopic(null);
      setSelectedChapter(null);
    } else if (level === "subjects") {
      setView("subjects");
      setSelectedSubject(null);
      setSelectedBook(null);
      setSelectedTopic(null);
      setSelectedChapter(null);
    } else if (level === "books") {
      setView("books");
      setSelectedBook(null);
      setSelectedTopic(null);
      setSelectedChapter(null);
    } else if (level === "chapters") {
      setView("chapters");
      setSelectedTopic(null);
      setSelectedChapter(null);
    } else if (level === "topic") {
      setView("topic");
    }
  };

  // Build breadcrumb items
  const breadcrumbItems = [
    { level: "home", label: "Library", icon: HomeIcon },
  ];
  if (selectedClass) {
    breadcrumbItems.push({
      level: "subjects",
      label: selectedClass.name,
      icon: AcademicCapIcon,
    });
  }
  if (selectedSubject) {
    breadcrumbItems.push({
      level: "books",
      label: selectedSubject.name,
      icon: BookOpenIcon,
    });
  }
  if (selectedBook) {
    breadcrumbItems.push({
      level: "chapters",
      label: selectedBook.title,
      icon: DocumentTextIcon,
    });
  }
  if (selectedTopic) {
    breadcrumbItems.push({
      level: "topic",
      label: selectedTopic.title,
      icon: DocumentTextIcon,
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto pb-24">
      {view !== "classes" && (
        <Breadcrumb items={breadcrumbItems} onNavigate={handleNavigate} />
      )}

      {view === "classes" && <ClassesView onSelectClass={handleSelectClass} />}

      {view === "subjects" && selectedClass && (
        <SubjectsView
          classData={selectedClass}
          onSelectSubject={handleSelectSubject}
          onBack={() => handleNavigate("home")}
        />
      )}

      {view === "books" && selectedClass && selectedSubject && (
        <BooksView
          classData={selectedClass}
          subjectData={selectedSubject}
          onSelectBook={handleSelectBook}
          onBack={() => handleNavigate("subjects")}
        />
      )}

      {view === "chapters" && selectedBook && (
        <ChapterTopicsView
          book={selectedBook}
          onBack={() => handleNavigate("books")}
          onSelectTopic={handleSelectTopic}
        />
      )}

      {view === "topic" && selectedTopic && (
        <TopicDetailView
          topic={selectedTopic}
          chapter={selectedChapter}
          book={selectedBook}
          libraryContext={{
            libraryClass: selectedClass,
            subject: selectedSubject,
            book: selectedBook,
            chapter: selectedChapter,
          }}
          onCreateSlides={handleCreateSlides}
        />
      )}

    </div>
  );
}
