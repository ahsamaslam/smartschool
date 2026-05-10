import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import adminService from "../../services/adminService";
import libraryService from "../../services/libraryService";
import Spinner from "../../components/common/Spinner";
import toast from "react-hot-toast";
import {
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  AcademicCapIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  UsersIcon,
  ArrowPathIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";

// ── Constants & Helpers ───────────────────────────────────────────────────────
const ALPHA = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const NUM = Array.from({ length: 30 }, (_, i) => String(i + 1));
const PRESET_SECTIONS = [...ALPHA, ...NUM];

function getRange(type, from, to) {
  if (!from || !to) return [];
  if (type === "alpha") {
    const start = Math.min(from.charCodeAt(0), to.charCodeAt(0));
    const end = Math.max(from.charCodeAt(0), to.charCodeAt(0));
    const res = [];
    for (let i = start; i <= end; i++) res.push(String.fromCharCode(i));
    return res;
  } else {
    const start = Math.min(Number(from), Number(to));
    const end = Math.max(Number(from), Number(to));
    const res = [];
    for (let i = start; i <= end; i++) res.push(String(i));
    return res;
  }
}

function SectionPicker({ value, onChange }) {
  const isCustom = value && !PRESET_SECTIONS.includes(value);
  const selectValue = isCustom ? "custom" : value || "";

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Section <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <div className="flex gap-2">
        <select
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === "custom") {
              onChange("custom_");
            } else {
              onChange(e.target.value);
            }
          }}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">No Section</option>
          <optgroup label="Alphabets (A-Z)">
            {ALPHA.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </optgroup>
          <optgroup label="Numbers (1-30)">
            {NUM.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </optgroup>
          <option value="custom">Custom...</option>
        </select>

        {isCustom && (
          <input
            autoFocus
            placeholder="Type section name…"
            value={value.startsWith("custom_") ? "" : value}
            onChange={(e) => onChange(e.target.value || "custom_")}
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
      </div>
    </div>
  );
}

// ── Inline Modal ──────────────────────────────────────────────────────────────
function Modal({ isOpen, onClose, title, children, wide }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} p-6 relative max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title, message, deleting }) {
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          disabled={deleting}
          className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
        >
          {deleting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
          Delete
        </button>
      </div>
    </Modal>
  );
}

function LinkSectionSubjectsModal({ isOpen, onClose, section, allSections, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [selectedBookIds, setSelectedBookIds] = useState([]);
  const [subjectBooks, setSubjectBooks] = useState({});
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [expandedSubjects, setExpandedSubjects] = useState({});

  const boards = Array.isArray(catalog?.boards) ? catalog.boards : [];
  const linkedByBoard = catalog?.linked_subjects_by_board || {};
  const activeBoard = boards.find((b) => b.id === selectedBoardId);
  const subjects = Array.isArray(activeBoard?.subjects) ? activeBoard.subjects : [];

  // Build a nice title: "Class 9 — Section A" or just "Class 9"
  const sectionLabel = section
    ? section.section
      ? `Class ${section.grade_level} — Section ${section.section}`
      : `Class ${section.grade_level}`
    : "Section";

  useEffect(() => {
    if (!isOpen || !section?.id) return;
    let mounted = true;
    setLoading(true);
    setSubjectBooks({});
    setSelectedBookIds([]);
    libraryService
      .getSectionSubjectCatalog(section.id)
      .then((res) => {
        if (!mounted) return;
        const data = res?.data?.data || res?.data || {};
        setCatalog(data);
        const firstBoardId = data?.boards?.[0]?.id || "";
        setSelectedBoardId(firstBoardId);
        setSelectedSubjectIds(firstBoardId ? (data?.linked_subjects_by_board?.[firstBoardId] || []) : []);
      })
      .catch(() => toast.error("Failed to load curriculum catalog."))
      .finally(() => mounted && setLoading(false));
    // Pre-load existing book assignments
    libraryService.getSectionCurriculum(section.id)
      .then((res) => {
        if (!mounted) return;
        const cur = res?.data?.data || {};
        setSelectedBookIds((cur.books || []).map((b) => b.id));
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [isOpen, section?.id]);

  useEffect(() => {
    if (!selectedBoardId) return;
    setSelectedSubjectIds(linkedByBoard[selectedBoardId] || []);
    setSelectedBookIds([]);
    setSubjectBooks({});
    setBookSearch("");
    setExpandedSubjects({});
  }, [selectedBoardId]); // eslint-disable-line

  // Load books when subject selection changes
  useEffect(() => {
    if (!selectedBoardId || selectedSubjectIds.length === 0) {
      setSubjectBooks({});
      setExpandedSubjects({});
      return;
    }
    let mounted = true;
    setLoadingBooks(true);
    Promise.all(
      selectedSubjectIds.map((sid) =>
        libraryService
          .getBoardSubjectBooks(selectedBoardId, sid)
          .then((res) => ({ sid, books: res?.data?.data || [] }))
          .catch(() => ({ sid, books: [] }))
      )
    ).then((results) => {
      if (!mounted) return;
      const map = {};
      const expanded = {};
      results.forEach(({ sid, books }) => {
        map[sid] = books;
        expanded[sid] = true;
      });
      setSubjectBooks(map);
      setExpandedSubjects(expanded);
    }).finally(() => mounted && setLoadingBooks(false));
    return () => { mounted = false; };
  }, [selectedBoardId, selectedSubjectIds.join(",")]); // eslint-disable-line

  const toggleSubject = (id) =>
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleBook = (id) =>
    setSelectedBookIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleAllForSubject = (sid, visibleBooks) => {
    const ids = visibleBooks.map((b) => b.id);
    const allSelected = ids.every((id) => selectedBookIds.includes(id));
    setSelectedBookIds((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    );
  };

  const handleSave = async () => {
    if (!section?.id || !selectedBoardId) return;
    setSaving(true);
    try {
      if (applyToAll && allSections?.length > 0) {
        await libraryService.bulkAssignSections({
          class_ids: allSections.map((s) => s.id),
          board_id: selectedBoardId,
          subject_ids: selectedSubjectIds,
          book_ids: selectedBookIds,
        });
        toast.success(`Course applied to all ${allSections.length} sections.`);
      } else {
        await libraryService.setSectionSubjects(section.id, {
          board_id: selectedBoardId,
          subject_ids: selectedSubjectIds,
        });
        await libraryService.setSectionBooks(section.id, {
          book_ids: selectedBookIds,
        });
        toast.success("Course updated.");
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update course.");
    } finally {
      setSaving(false);
    }
  };

  const allBooks = Object.values(subjectBooks).flat();

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose?.()}
      title={`Assign Course — ${sectionLabel}`}
      wide
    >
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
      ) : boards.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">
          No boards configured.{" "}
          <Link to="/admin/library" className="text-indigo-600 hover:underline">Go to Library →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Apply to all toggle */}
          {allSections?.length > 1 && (
            <label className="flex items-center gap-2 p-3 bg-indigo-50 rounded-xl cursor-pointer border border-indigo-100">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-indigo-700">
                Apply to all sections in Class {section?.grade_level} ({allSections.length} sections)
              </span>
            </label>
          )}

          {/* Board */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Board</label>
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Subjects */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Subjects</p>
            {subjects.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                No subjects for this board.{" "}
                <Link to="/admin/library" className="text-indigo-600 hover:underline">Add in Library →</Link>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-2 space-y-1">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.includes(s.id)}
                      onChange={() => toggleSubject(s.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-800">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Books */}
          {selectedSubjectIds.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Books</p>
                {selectedBookIds.length > 0 && (
                  <span className="text-xs text-indigo-600 font-medium">
                    {selectedBookIds.length} selected
                  </span>
                )}
              </div>
              {loadingBooks ? (
                <div className="text-sm text-gray-400 py-3 text-center">Loading books…</div>
              ) : allBooks.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                  No books found for selected subjects.{" "}
                  <Link to="/admin/ai-parser" className="text-indigo-600 hover:underline">Add via AI Parser →</Link>
                </div>
              ) : (
                <>
                  {/* Search */}
                  <input
                    type="text"
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    placeholder="Search books…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {/* Accordion */}
                  <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {selectedSubjectIds.map((sid) => {
                      const allSBooks = subjectBooks[sid] || [];
                      const q = bookSearch.toLowerCase();
                      const sBooks = q ? allSBooks.filter((b) => b.title.toLowerCase().includes(q)) : allSBooks;
                      if (allSBooks.length === 0) return null;
                      const subjectName = subjects.find((s) => s.id === sid)?.name || "";
                      const selectedCount = allSBooks.filter((b) => selectedBookIds.includes(b.id)).length;
                      const isOpen = expandedSubjects[sid] !== false;
                      const allVisibleSelected = sBooks.length > 0 && sBooks.every((b) => selectedBookIds.includes(b.id));
                      return (
                        <div key={sid}>
                          {/* Subject header */}
                          <div
                            className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                            onClick={() => setExpandedSubjects((p) => ({ ...p, [sid]: !isOpen }))}
                          >
                            {isOpen
                              ? <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              : <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            }
                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex-1">{subjectName}</span>
                            {selectedCount > 0 && (
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                {selectedCount}/{allSBooks.length}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleAllForSubject(sid, sBooks.length > 0 ? sBooks : allSBooks); }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0 ml-1"
                            >
                              {allVisibleSelected ? "Deselect All" : "Select All"}
                            </button>
                          </div>
                          {/* Books list */}
                          {isOpen && (
                            <div className="py-1">
                              {sBooks.length === 0 ? (
                                <p className="text-xs text-gray-400 px-4 py-2">No books match "{bookSearch}"</p>
                              ) : (
                                sBooks.map((book) => (
                                  <label key={book.id} className="flex items-start gap-2 px-4 py-2 hover:bg-indigo-50 cursor-pointer transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={selectedBookIds.includes(book.id)}
                                      onChange={() => toggleBook(book.id)}
                                      className="rounded mt-0.5 flex-shrink-0 accent-indigo-600"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-sm text-gray-800 leading-snug">{book.title}</p>
                                      <p className="text-xs text-gray-400">
                                        {book.author ? `${book.author} · ` : ""}{book.chapter_count ?? 0} ch · {book.topic_count ?? 0} topics
                                      </p>
                                    </div>
                                  </label>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedBoardId}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : applyToAll ? "Apply to All Sections" : "Save Course"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Class Row ─────────────────────────────────────────────────────────────────
function ClassRow({ cls, onEdit, onDelete, onLinkSubjects, branchName, schoolName }) {
  const navigate = useNavigate();
  const label = cls.section ? `Sec ${cls.section}` : "Main Section";

  const handleClick = () => {
    navigate(`/admin/sections/${cls.id}`, {
      state: {
        classId: cls.id,
        returnToClassPath: `/admin/classes/${cls.id}`,
        branchId: cls.branch_id,
        gradeLevel: cls.grade_level,
        branchName,
        schoolName,
      },
    });
  };

  return (
    <div
      onClick={handleClick}
      className="group flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-gray-100 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all"
      title="View section details"
    >
      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
        <AcademicCapIcon className="h-3.5 w-3.5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
        {cls.teacher_name && <p className="text-xs text-gray-400 truncate">Teacher: {cls.teacher_name}</p>}
      </div>
      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-md text-xs font-medium text-gray-600 flex-shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors">
        <UsersIcon className="h-3.5 w-3.5" />
        {cls.student_count ?? 0}
      </span>
      <span className="text-xs font-medium text-indigo-600 flex-shrink-0 hidden sm:inline">
        Open section
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (typeof onLinkSubjects === "function") onLinkSubjects(cls);
          }}
          className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50"
          title="Link subjects"
        >
          <BookOpenIcon className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (typeof onEdit === "function") onEdit(cls);
          }}
          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50"
        >
          <PencilSquareIcon className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (typeof onDelete === "function") onDelete(cls);
          }}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Class Group Panel ─────────────────────────────────────────────────────────
function ClassGroupPanel({ gradeLevel, classes, onEdit, onDelete, onManageSections, onLinkSubjects, forceOpen, branchName, schoolName }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isOpen = forceOpen || open;

  const groupStudentTotal = useMemo(() => {
    return classes.reduce((sum, c) => sum + (c.student_count || 0), 0);
  }, [classes]);

  const openAllSections = (e) => {
    e.stopPropagation();
    const classRef = classes[0];
    if (!classRef) return;
    navigate(`/admin/classes/${classRef.id}`, {
      state: {
        branchId: classRef.branch_id,
        gradeLevel,
        branchName,
        schoolName,
      },
    });
  };

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden mb-2 bg-white shadow-sm group/classgroup">
      <div
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer select-none"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}
      >
        {isOpen ? (
          <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        )}
        <div className="flex-1 font-bold text-gray-800 text-sm">Class {gradeLevel}</div>
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0 mr-1">
          <span>{classes.length} section{classes.length === 1 ? '' : 's'}</span>
          <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
            <UsersIcon className="h-3.5 w-3.5" />
            {groupStudentTotal}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAllSections}
            className="opacity-0 group-hover/classgroup:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold"
            title="See all sections for this class"
          >
            All Sections
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onManageSections(gradeLevel); }}
            className="opacity-0 group-hover/classgroup:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold"
            title="Manage sections for this class"
          >
            <PlusIcon className="h-3 w-3" /> Section
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {classes.map((cls) => (
              <ClassRow
                key={cls.id}
                cls={cls}
                onEdit={onEdit}
                onDelete={onDelete}
                onLinkSubjects={onLinkSubjects}
                branchName={branchName}
                schoolName={schoolName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Branch Panel ──────────────────────────────────────────────────────────────
function BranchPanel({ branch, branchClasses, branchTeacherCount, onEdit, onDelete, onRefresh, forceOpen, schoolName }) {
  const [open, setOpen] = useState(false);

  // Class Modal state
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);

  // Forms
  const [creationMode, setCreationMode] = useState("single"); // 'single' | 'multiple'
  const [classForm, setClassForm] = useState({ grade_level: "", section: "" });
  const [multiForm, setMultiForm] = useState({ grade_level: "", type: "alpha", from: "A", to: "C" });
  const [savingClass, setSavingClass] = useState(false);

  // Delete Class state
  const [deletingClass, setDeletingClass] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [linkSubjectsFor, setLinkSubjectsFor] = useState(null);

  const isOpen = forceOpen || open;
  const handleToggle = () => setOpen(!open);

  const branchStudentTotal = useMemo(() => {
    return branchClasses.reduce((sum, c) => sum + (c.student_count || 0), 0);
  }, [branchClasses]);

  const classesByGrade = useMemo(() => {
    const groups = {};
    branchClasses.forEach(c => {
      const gl = c.grade_level || "Unknown";
      if (!groups[gl]) groups[gl] = [];
      groups[gl].push(c);
    });
    return groups;
  }, [branchClasses]);

  const openAddClass = (e) => {
    e.stopPropagation();
    setEditingClass(null);
    setCreationMode("single");
    setClassForm({ grade_level: "", section: "" });
    setMultiForm({ grade_level: "", type: "alpha", from: "A", to: "C" });
    setShowClassModal(true);
  };

  const openEditClass = (cls) => {
    setEditingClass(cls);
    setCreationMode("single");
    setClassForm({ grade_level: cls.grade_level || "", section: cls.section || "" });
    setShowClassModal(true);
  };

  const openManageSections = (gradeLevel) => {
    setEditingClass(null);
    setCreationMode("single");
    setClassForm({ grade_level: gradeLevel, section: "" });
    setShowClassModal(true);
  };

  const handleSaveClass = async (e) => {
    e.preventDefault();
    setSavingClass(true);

    try {
      if (editingClass) {
        // Edit single class
        if (!classForm.grade_level.trim()) throw new Error("Class level is required.");
        const sectionVal = classForm.section?.startsWith("custom_") ? "" : classForm.section;
        const computedName = sectionVal ? `${classForm.grade_level} - ${sectionVal}` : classForm.grade_level;

        await adminService.updateClass(editingClass.id, {
          name: computedName,
          grade_level: classForm.grade_level,
          section: sectionVal || null,
        });
        toast.success("Class updated!");
      } else {
        // Create classes
        if (creationMode === "single") {
          if (!classForm.grade_level.trim()) throw new Error("Class level is required.");
          const sectionVal = classForm.section?.startsWith("custom_") ? "" : classForm.section;
          const computedName = sectionVal ? `${classForm.grade_level} - ${sectionVal}` : classForm.grade_level;

          await adminService.createClass({
            branch_id: branch.id,
            name: computedName,
            grade_level: classForm.grade_level,
            section: sectionVal || null,
          });
          toast.success("Class created!");
        } else {
          // Multiple Sections
          if (!multiForm.grade_level.trim()) throw new Error("Class level is required.");
          const range = getRange(multiForm.type, multiForm.from, multiForm.to);
          if (range.length === 0) throw new Error("Invalid range selected.");
          if (range.length > 50) throw new Error("Cannot create more than 50 classes at once.");

          // Create concurrently
          await Promise.all(
            range.map((sec) => {
              const name = `${multiForm.grade_level} - ${sec}`;
              return adminService.createClass({
                branch_id: branch.id,
                name: name,
                grade_level: multiForm.grade_level,
                section: sec,
              });
            })
          );
          toast.success(`${range.length} Classes created!`);
        }
      }
      setShowClassModal(false);
      onRefresh?.();
      setOpen(true);
    } catch (err) {
      toast.error(err.message || "Failed to save class(es).");
    } finally {
      setSavingClass(false);
    }
  };

  const confirmDeleteClass = async () => {
    if (!deletingClass) return;
    setIsDeleting(true);
    try {
      await adminService.deleteClass(deletingClass.id);
      toast.success("Class deleted.");
      setDeletingClass(null);
      onRefresh?.();
    } catch {
      toast.error("Failed to delete class.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden group/branch relative">
      {/* Branch header */}
      <div className="flex items-center">
        <button
          onClick={handleToggle}
          className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-blue-50/40 transition-colors text-left"
        >
          {isOpen ? (
            <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          )}
          <BuildingStorefrontIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{branch.name}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate flex items-center gap-1">
              <MapPinIcon className="h-3 w-3" />
              {branch.city}, {branch.address}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
            <span>{Object.keys(classesByGrade).length} class{Object.keys(classesByGrade).length === 1 ? '' : 'es'}</span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
              {branchTeacherCount} teacher{branchTeacherCount === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              <UsersIcon className="h-3.5 w-3.5" />
              {branchStudentTotal}
            </span>
          </div>
        </button>

        {/* Branch Actions */}
        <div className="flex items-center pr-3 opacity-0 group-hover/branch:opacity-100 transition-opacity">
          <button onClick={() => onEdit(branch)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50" title="Edit Branch">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(branch)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 mr-2" title="Delete Branch">
            <TrashIcon className="h-4 w-4" />
          </button>
          <button
            onClick={openAddClass}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Class
          </button>
        </div>
      </div>

      {/* Classes Grouped by Grade */}
      {isOpen && (
        <div className="border-t border-gray-50 bg-gray-50/40 px-4 py-3">
          {!branchClasses?.length ? (
            <p className="text-xs text-gray-400 py-2 text-center">
              No classes yet.{" "}
              <button onClick={openAddClass} className="text-indigo-600 hover:underline">
                Add one →
              </button>
            </p>
          ) : (
            <div>
              {Object.entries(classesByGrade).map(([gradeLevel, classes]) => (
                <ClassGroupPanel
                  key={gradeLevel}
                  gradeLevel={gradeLevel}
                  classes={classes}
                  onEdit={openEditClass}
                  onDelete={setDeletingClass}
                  onLinkSubjects={(c) => setLinkSubjectsFor(c)}
                  onManageSections={openManageSections}
                  forceOpen={forceOpen}
                  branchName={branch.name}
                  schoolName={schoolName}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Class Modal */}
      <Modal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        title={editingClass ? `Edit Class` : `Add Class — ${branch.name}`}
      >
        <form onSubmit={handleSaveClass} className="space-y-5">
          {!editingClass && (
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCreationMode("single")}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors ${creationMode === "single" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                1 Section
              </button>
              <button
                type="button"
                onClick={() => setCreationMode("multiple")}
                className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors ${creationMode === "multiple" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >
                Multiple Sections
              </button>
            </div>
          )}

          {creationMode === "single" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class <span className="text-red-500">*</span>
                </label>
                <input
                  value={classForm.grade_level}
                  onChange={(e) => setClassForm((f) => ({ ...f, grade_level: e.target.value }))}
                  placeholder="e.g. 9, 10, O-Levels"
                  required
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <SectionPicker
                value={classForm.section}
                onChange={(v) => setClassForm((f) => ({ ...f, section: v }))}
              />
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class <span className="text-red-500">*</span>
                </label>
                <input
                  value={multiForm.grade_level}
                  onChange={(e) => setMultiForm((f) => ({ ...f, grade_level: e.target.value }))}
                  placeholder="e.g. 9, 10, O-Levels"
                  required
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section Naming</label>
                <select
                  value={multiForm.type}
                  onChange={(e) => setMultiForm((f) => ({ ...f, type: e.target.value, from: e.target.value === 'alpha' ? 'A' : '1', to: e.target.value === 'alpha' ? 'C' : '3' }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="alpha">Alphabets (A, B, C...)</option>
                  <option value="number">Numbers (1, 2, 3...)</option>
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <select
                    value={multiForm.from}
                    onChange={(e) => setMultiForm((f) => ({ ...f, from: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {(multiForm.type === 'alpha' ? ALPHA : NUM).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <select
                    value={multiForm.to}
                    onChange={(e) => setMultiForm((f) => ({ ...f, to: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {(multiForm.type === 'alpha' ? ALPHA : NUM).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-indigo-50 text-indigo-700 p-3 rounded-xl text-sm">
                This will automatically create <strong>{getRange(multiForm.type, multiForm.from, multiForm.to).length}</strong> classes.
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={savingClass}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {savingClass ? "Saving…" : (editingClass ? "Save Changes" : "Create Classes")}
          </button>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={!!deletingClass}
        onClose={() => setDeletingClass(null)}
        onConfirm={confirmDeleteClass}
        deleting={isDeleting}
        title="Delete Class"
        message={`Are you sure you want to delete this class? All associated enrollments and data will be lost.`}
      />

      <LinkSectionSubjectsModal
        isOpen={!!linkSubjectsFor}
        section={linkSubjectsFor}
        allSections={linkSubjectsFor ? (branchClasses || []).filter((c) => c.grade_level === linkSubjectsFor.grade_level) : []}
        onClose={() => setLinkSubjectsFor(null)}
        onSaved={onRefresh}
      />
    </div>
  );
}

// ── School Card ───────────────────────────────────────────────────────────────
function SchoolCard({ school, schoolBranches, allClasses, teacherCountsByBranch, teacherCountsBySchool, onRefresh, onEdit, onDelete, forceOpen }) {
  const [open, setOpen] = useState(false);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [branchForm, setBranchForm] = useState({ name: "", city: "", address: "" });
  const [savingBranch, setSavingBranch] = useState(false);

  const [deletingBranch, setDeletingBranch] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOpen = forceOpen || open;
  const handleToggle = () => setOpen(!open);

  const { schoolStudentTotal, schoolClassTotal } = useMemo(() => {
    let studentSum = 0;
    let classSum = 0;
    schoolBranches.forEach(branch => {
      const bClasses = allClasses.filter(c => c.branch_id === branch.id);
      studentSum += bClasses.reduce((s, c) => s + (c.student_count || 0), 0);
      const uniqueClasses = new Set(bClasses.map(c => c.grade_level));
      classSum += uniqueClasses.size;
    });
    return { schoolStudentTotal: studentSum, schoolClassTotal: classSum };
  }, [schoolBranches, allClasses]);
  const schoolTeacherTotal = teacherCountsBySchool[school.id] || 0;

  const openAddBranch = (e) => {
    e.stopPropagation();
    setEditingBranch(null);
    setBranchForm({ name: "", city: "", address: "" });
    setShowBranchModal(true);
  };

  const openEditBranch = (branch) => {
    setEditingBranch(branch);
    setBranchForm({ name: branch.name, city: branch.city || "", address: branch.address || "" });
    setShowBranchModal(true);
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    if (!branchForm.name.trim()) return toast.error("Branch name is required.");
    if (!branchForm.city.trim()) return toast.error("City is required.");
    if (!branchForm.address.trim()) return toast.error("Address is required.");

    const payload = {
      school_id: school.id,
      name: branchForm.name,
      city: branchForm.city,
      address: branchForm.address,
    };

    setSavingBranch(true);
    try {
      if (editingBranch) {
        await adminService.updateBranch(editingBranch.id, payload);
        toast.success("Branch updated!");
      } else {
        await adminService.createBranch(payload);
        toast.success("Branch created!");
      }
      setShowBranchModal(false);
      onRefresh?.();
      setOpen(true);
    } catch {
      toast.error(editingBranch ? "Failed to update branch." : "Failed to create branch.");
    } finally {
      setSavingBranch(false);
    }
  };

  const confirmDeleteBranch = async () => {
    if (!deletingBranch) return;
    setIsDeleting(true);
    try {
      await adminService.deleteBranch(deletingBranch.id);
      toast.success("Branch deleted.");
      setDeletingBranch(null);
      onRefresh?.();
    } catch {
      toast.error("Failed to delete branch.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm group/school relative">
      {/* School header */}
      <div className="flex items-center">
        <button
          onClick={handleToggle}
          className="flex-1 flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
        >
          {isOpen ? (
            <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <BuildingOfficeIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{school.name}</p>
            {school.address && <p className="text-xs text-gray-400 truncate mt-0.5">{school.address}</p>}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400 flex-shrink-0 mr-2">
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {schoolBranches.length} branch{schoolBranches.length === 1 ? '' : 'es'}
            </span>
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
              {schoolTeacherTotal} teacher{schoolTeacherTotal === 1 ? "" : "s"}
            </span>
            <span>{schoolClassTotal} class{schoolClassTotal === 1 ? '' : 'es'}</span>
            <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              <UsersIcon className="h-4 w-4" />
              {schoolStudentTotal}
            </span>
          </div>
        </button>

        {/* School Actions */}
        <div className="flex items-center pr-4 opacity-0 group-hover/school:opacity-100 transition-opacity">
          <button onClick={() => onEdit(school)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50" title="Edit School">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(school)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 mr-3" title="Delete School">
            <TrashIcon className="h-4 w-4" />
          </button>
          <button
            onClick={openAddBranch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-semibold transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Branch
          </button>
        </div>
      </div>

      {/* Branches */}
      {isOpen && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2.5 bg-gray-50/30">
          {!schoolBranches?.length ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No branches yet.{" "}
              <button onClick={openAddBranch} className="text-indigo-600 hover:underline">
                Add the first branch →
              </button>
            </p>
          ) : (
            schoolBranches.map((branch) => (
              <BranchPanel
                key={branch.id}
                branch={branch}
                branchClasses={allClasses.filter(c => c.branch_id === branch.id)}
                branchTeacherCount={teacherCountsByBranch[branch.id] || 0}
                onEdit={openEditBranch}
                onDelete={setDeletingBranch}
                onRefresh={onRefresh}
                forceOpen={forceOpen}
                schoolName={school.name}
              />
            ))
          )}
        </div>
      )}

      {/* Add/Edit Branch Modal */}
      <Modal
        isOpen={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        title={editingBranch ? `Edit Branch` : `Add Branch — ${school.name}`}
      >
        <form onSubmit={handleSaveBranch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch Name <span className="text-red-500">*</span>
            </label>
            <input
              value={branchForm.name}
              onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. DHA Branch, Gulberg Campus"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City <span className="text-red-500">*</span>
            </label>
            <input
              value={branchForm.city}
              onChange={(e) => setBranchForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="e.g. Lahore, Karachi, Islamabad"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              value={branchForm.address}
              onChange={(e) => setBranchForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Full street address"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingBranch}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {savingBranch ? "Saving…" : (editingBranch ? "Save Changes" : "Create Branch")}
          </button>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={!!deletingBranch}
        onClose={() => setDeletingBranch(null)}
        onConfirm={confirmDeleteBranch}
        deleting={isDeleting}
        title="Delete Branch"
        message={`Are you sure you want to delete "${deletingBranch?.name}"? All associated classes and data will be lost.`}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminSchools() {
  const [data, setData] = useState({ schools: [], branches: [], classes: [] });
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [schoolForm, setSchoolForm] = useState({ name: "", address: "" });
  const [savingSchool, setSavingSchool] = useState(false);

  const [deletingSchool, setDeletingSchool] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const empty = { schools: [], branches: [], classes: [] };
    const requestOpts = { timeout: 22000 };

    try {
      const [schoolOutcome, teachersOutcome] = await Promise.allSettled([
        adminService.getAllSchoolData(requestOpts),
        adminService.getUsers("teacher", requestOpts),
      ]);

      if (schoolOutcome.status === "fulfilled") {
        const raw = schoolOutcome.value.data ?? {};
        const payload = raw?.data ?? raw;
        const normalized = {
          schools: Array.isArray(payload?.schools) ? payload.schools : [],
          branches: Array.isArray(payload?.branches) ? payload.branches : [],
          classes: Array.isArray(payload?.classes) ? payload.classes : [],
        };
        setData(normalized);
        if (
          payload &&
          typeof payload === "object" &&
          (!Array.isArray(payload.schools) ||
            !Array.isArray(payload.branches) ||
            !Array.isArray(payload.classes)) &&
          import.meta.env.DEV
        ) {
          console.warn("[AdminSchools] Partial or unexpected payload shape — normalized", raw);
        }
      } else {
        toast.error(
          schoolOutcome.reason?.response?.status === 401
            ? "Session expired — sign in again."
            : "Could not load schools list. Is the API running?",
        );
        setData(empty);
      }

      if (teachersOutcome.status === "fulfilled") {
        const raw = teachersOutcome.value.data;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        setTeachers(list);
      } else {
        if (schoolOutcome.status === "fulfilled") {
          toast.error("Teachers list failed — branch teacher counts may be incomplete.");
        }
        setTeachers([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const globalStudentTotal = useMemo(() => {
    return data.classes.reduce((sum, c) => sum + (c.student_count || 0), 0);
  }, [data.classes]);

  const globalClassTotal = useMemo(() => {
    const uniqueClasses = new Set(data.classes.map(c => `${c.branch_id}|${c.grade_level}`));
    return uniqueClasses.size;
  }, [data.classes]);

  const teacherCountsByBranch = useMemo(() => {
    const counts = {};
    teachers.forEach((t) => {
      if (!t?.branch_id || t?.is_active === false) return;
      counts[t.branch_id] = (counts[t.branch_id] || 0) + 1;
    });
    return counts;
  }, [teachers]);

  const teacherCountsBySchool = useMemo(() => {
    const counts = {};
    teachers.forEach((t) => {
      if (!t?.school_id || t?.is_active === false) return;
      counts[t.school_id] = (counts[t.school_id] || 0) + 1;
    });
    return counts;
  }, [teachers]);

  const globalTeacherTotal = useMemo(
    () => teachers.filter((t) => t?.is_active !== false).length,
    [teachers],
  );

  // Deep Search Filtering Logic
  const filteredData = useMemo(() => {
    if (!search.trim()) {
      return {
        schools: data.schools,
        branches: data.branches,
        classes: data.classes,
        isSearching: false
      };
    }

    const lower = search.toLowerCase();

    // Direct matches
    const directSchools = new Set();
    const directBranches = new Set();
    const directClasses = new Set();

    data.schools.forEach((s) => {
      const name = String(s?.name ?? "");
      const addr = String(s?.address ?? "");
      if (name.toLowerCase().includes(lower) || addr.toLowerCase().includes(lower)) {
        directSchools.add(s.id);
      }
    });
    data.branches.forEach((b) => {
      const name = String(b?.name ?? "");
      const city = String(b?.city ?? "");
      const addr = String(b?.address ?? "");
      if (
        name.toLowerCase().includes(lower) ||
        city.toLowerCase().includes(lower) ||
        addr.toLowerCase().includes(lower)
      ) {
        directBranches.add(b.id);
      }
    });
    data.classes.forEach(c => {
      const label = `${c.grade_level || ""} ${c.section || ""} ${c.name || ""}`.toLowerCase();
      if (label.includes(lower)) {
        directClasses.add(c.id);
      }
    });

    const finalSchools = new Set(directSchools);
    const finalBranches = new Set(directBranches);
    const finalClasses = new Set(directClasses);

    // Upward propagation (child matched -> show parent)
    data.classes.forEach(c => {
      if (finalClasses.has(c.id)) finalBranches.add(c.branch_id);
    });
    data.branches.forEach(b => {
      if (finalBranches.has(b.id)) finalSchools.add(b.school_id);
    });

    // Downward propagation ONLY from direct matches (parent matched -> show all its children)
    data.branches.forEach(b => {
      if (directSchools.has(b.school_id)) finalBranches.add(b.id);
    });
    data.classes.forEach(c => {
      const branch = data.branches.find(br => br.id === c.branch_id);
      if (directBranches.has(c.branch_id) || (branch && directSchools.has(branch.school_id))) {
        finalClasses.add(c.id);
      }
    });

    return {
      schools: data.schools.filter(s => finalSchools.has(s.id)),
      branches: data.branches.filter(b => finalBranches.has(b.id)),
      classes: data.classes.filter(c => finalClasses.has(c.id)),
      isSearching: true
    };
  }, [data, search]);

  const openAddSchool = () => {
    setEditingSchool(null);
    setSchoolForm({ name: "", address: "" });
    setShowSchoolModal(true);
  };

  const openEditSchool = (school) => {
    setEditingSchool(school);
    setSchoolForm({ name: school.name, address: school.address });
    setShowSchoolModal(true);
  };

  const handleSaveSchool = async (e) => {
    e.preventDefault();
    if (!schoolForm.name.trim()) return toast.error("School name is required.");
    if (!schoolForm.address.trim()) return toast.error("School address is required.");
    setSavingSchool(true);
    try {
      if (editingSchool) {
        await adminService.updateSchool(editingSchool.id, schoolForm);
        toast.success("School updated!");
      } else {
        await adminService.createSchool(schoolForm);
        toast.success("School created!");
      }
      setShowSchoolModal(false);
      loadData();
    } catch {
      toast.error(editingSchool ? "Failed to update school." : "Failed to create school.");
    } finally {
      setSavingSchool(false);
    }
  };

  const confirmDeleteSchool = async () => {
    if (!deletingSchool) return;
    setIsDeleting(true);
    try {
      await adminService.deleteSchool(deletingSchool.id);
      toast.success("School deleted.");
      setDeletingSchool(null);
      loadData();
    } catch {
      toast.error("Failed to delete school.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[50vh] gap-4 text-gray-500">
        <Spinner size="lg" />
        <p className="text-sm">Loading schools…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage schools, branches, and classes.
          </p>
        </div>
        <button
          onClick={openAddSchool}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <PlusIcon className="h-4 w-4" /> Add School
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: data.schools.length === 1 ? "School" : "Schools", value: data.schools.length, color: "bg-blue-50 text-blue-700" },
          { label: data.branches.length === 1 ? "Branch" : "Branches", value: data.branches.length, color: "bg-green-50 text-green-700" },
          { label: globalClassTotal === 1 ? "Class" : "Classes", value: globalClassTotal, color: "bg-amber-50 text-amber-700" },
          { label: globalTeacherTotal === 1 ? "Teacher" : "Teachers", value: globalTeacherTotal, color: "bg-emerald-50 text-emerald-700" },
          { label: globalStudentTotal === 1 ? "Total Student" : "Total Students", value: globalStudentTotal, color: "bg-indigo-50 text-indigo-700" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.color} rounded-2xl p-4`}>
            <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
            <p className="text-xs font-medium mt-0.5 opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Deep Search */}
      <div className="relative mb-5 max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search schools, branches, or classes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
        />
      </div>

      {/* Schools Tree */}
      {filteredData.schools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <BuildingOfficeIcon className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {data.schools.length === 0 ? "No schools yet." : "No records match your search."}
          </p>
          {data.schools.length === 0 && (
            <button
              onClick={openAddSchool}
              className="mt-3 text-sm text-indigo-600 hover:underline"
            >
              Add your first school →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredData.schools.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              schoolBranches={filteredData.branches.filter(b => b.school_id === school.id)}
              allClasses={filteredData.classes}
              teacherCountsByBranch={teacherCountsByBranch}
              teacherCountsBySchool={teacherCountsBySchool}
              onRefresh={loadData}
              onEdit={openEditSchool}
              onDelete={setDeletingSchool}
              forceOpen={filteredData.isSearching}
            />
          ))}
        </div>
      )}

      {/* Add/Edit School Modal */}
      <Modal
        isOpen={showSchoolModal}
        onClose={() => setShowSchoolModal(false)}
        title={editingSchool ? "Edit School" : "Add New School"}
      >
        <form onSubmit={handleSaveSchool} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              School Name <span className="text-red-500">*</span>
            </label>
            <input
              value={schoolForm.name}
              onChange={(e) => setSchoolForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Allied School, City Grammar School"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              value={schoolForm.address}
              onChange={(e) => setSchoolForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Main office address"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingSchool}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {savingSchool ? "Saving…" : (editingSchool ? "Save Changes" : "Create School")}
          </button>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={!!deletingSchool}
        onClose={() => setDeletingSchool(null)}
        onConfirm={confirmDeleteSchool}
        deleting={isDeleting}
        title="Delete School"
        message={`Are you sure you want to delete "${deletingSchool?.name}"? All associated branches, classes, and data will be permanently lost.`}
      />
    </div>
  );
}
