import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import managerService from "../../services/managerService";
import libraryService from "../../services/libraryService";
import toast from "react-hot-toast";
import { PageSpinner } from "../../components/common/Spinner";
import {
  BuildingStorefrontIcon,
  AcademicCapIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MapPinIcon,
  UsersIcon,
  ArrowPathIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";

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
    libraryService.getSectionSubjectCatalog(section.id)
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
        libraryService.getBoardSubjectBooks(selectedBoardId, sid)
          .then((res) => ({ sid, books: res?.data?.data || [] }))
          .catch(() => ({ sid, books: [] }))
      )
    ).then((results) => {
      if (!mounted) return;
      const map = {};
      const expanded = {};
      results.forEach(({ sid, books }) => { map[sid] = books; expanded[sid] = true; });
      setSubjectBooks(map);
      setExpandedSubjects(expanded);
    }).finally(() => mounted && setLoadingBooks(false));
    return () => { mounted = false; };
  }, [selectedBoardId, selectedSubjectIds.join(",")]); // eslint-disable-line

  const toggleSubject = (id) =>
    setSelectedSubjectIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleBook = (id) =>
    setSelectedBookIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

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
        await libraryService.setSectionSubjects(section.id, { board_id: selectedBoardId, subject_ids: selectedSubjectIds });
        await libraryService.setSectionBooks(section.id, { book_ids: selectedBookIds });
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

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose?.()} title={`Assign Course — ${sectionLabel}`} wide>
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
      ) : boards.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">
          No boards configured. Contact your admin to set up the library.
        </div>
      ) : (
        <div className="space-y-4">
          {allSections?.length > 1 && (
            <label className="flex items-center gap-2 p-3 bg-indigo-50 rounded-xl cursor-pointer border border-indigo-100">
              <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} className="rounded" />
              <span className="text-sm font-medium text-indigo-700">
                Apply to all sections in Class {section?.grade_level} ({allSections.length} sections)
              </span>
            </label>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Board</label>
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subjects</label>
            <div className="grid grid-cols-2 gap-2">
              {subjects.map((s) => (
                <label key={s.id} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedSubjectIds.includes(s.id) ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-indigo-200"}`}>
                  <input type="checkbox" checked={selectedSubjectIds.includes(s.id)} onChange={() => toggleSubject(s.id)} className="rounded" />
                  <span className="text-sm text-gray-700">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          {selectedSubjectIds.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Books</label>
                <input
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  placeholder="Search books…"
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-40"
                />
              </div>
              {loadingBooks ? (
                <div className="text-sm text-gray-400 py-3 text-center">Loading books…</div>
              ) : (
                <div className="space-y-3">
                  {selectedSubjectIds.map((sid) => {
                    const subj = subjects.find((s) => s.id === sid);
                    const sBooks = (subjectBooks[sid] || []).filter((b) =>
                      !bookSearch || b.title?.toLowerCase().includes(bookSearch.toLowerCase())
                    );
                    if (!subj) return null;
                    return (
                      <div key={sid} className="border border-gray-100 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedSubjects((p) => ({ ...p, [sid]: !p[sid] }))}
                          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                          <span>{subj.name}</span>
                          <div className="flex items-center gap-2">
                            {sBooks.length > 0 && (
                              <span
                                onClick={(e) => { e.stopPropagation(); toggleAllForSubject(sid, sBooks); }}
                                className="text-xs text-indigo-600 hover:underline"
                              >
                                {sBooks.every((b) => selectedBookIds.includes(b.id)) ? "Deselect all" : "Select all"}
                              </span>
                            )}
                            <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expandedSubjects[sid] ? "rotate-180" : ""}`} />
                          </div>
                        </button>
                        {expandedSubjects[sid] && (
                          <div className="px-3 py-2 space-y-1.5">
                            {sBooks.length === 0 ? (
                              <p className="text-xs text-gray-400 px-1 py-2">No books match.</p>
                            ) : sBooks.map((book) => (
                              <label key={book.id} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedBookIds.includes(book.id) ? "border-indigo-400 bg-indigo-50" : "border-gray-100 hover:border-indigo-200"}`}>
                                <input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={() => toggleBook(book.id)} className="rounded mt-0.5" />
                                <div>
                                  <p className="text-sm text-gray-800">{book.title}</p>
                                  {book.author && <p className="text-xs text-gray-400">{book.author}</p>}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving || !selectedBoardId} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
              {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save Course"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ClassRow({ cls, onEdit, onDelete, onLinkSubjects, branchName }) {
  const navigate = useNavigate();
  const label = cls.section ? `Sec ${cls.section}` : "Main Section";

  const handleClick = () => {
    navigate(`/manager/sections/${cls.id}`, {
      state: {
        classId: cls.id,
        returnToClassPath: `/manager/school`,
        branchId: cls.branch_id,
        gradeLevel: cls.grade_level,
        branchName,
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
      <span className="text-xs font-medium text-indigo-600 flex-shrink-0 hidden sm:inline">Open section</span>
      <div className="flex items-center gap-1 ml-1">
        <button
          onClick={(e) => { e.stopPropagation(); if (typeof onLinkSubjects === "function") onLinkSubjects(cls); }}
          className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50 transition-colors"
          title="Link subjects"
        >
          <BookOpenIcon className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (typeof onEdit === "function") onEdit(cls);
          }}
          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors"
          title="Edit class"
        >
          <PencilSquareIcon className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (typeof onDelete === "function") onDelete(cls);
          }}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
          title="Delete class"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ClassGroupPanel({ gradeLevel, classes, onEdit, onDelete, onManageSections, onLinkSubjects, branchName }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const groupStudentTotal = useMemo(() => {
    return classes.reduce((sum, c) => sum + (c.student_count || 0), 0);
  }, [classes]);

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden mb-2 bg-white shadow-sm group/classgroup">
      <div
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer select-none"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}
      >
        {open ? (
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
            onClick={(e) => {
              e.stopPropagation();
              const ref = classes[0];
              if (ref) navigate(`/manager/classes/${ref.id}`, { state: { branchId: ref.branch_id, gradeLevel, branchName } });
            }}
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
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(classes[0]); }}
            className="opacity-0 group-hover/classgroup:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold"
            title="Delete entire class"
          >
            <TrashIcon className="h-3 w-3" /> Class
          </button>
        </div>
      </div>

      {open && (
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
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BranchPanel({ branch, branchClasses, onEdit, onDelete, onRefresh }) {
  const [open, setOpen] = useState(true);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [linkSubjectsFor, setLinkSubjectsFor] = useState(null);
  const [creationMode, setCreationMode] = useState("single");
  const [classForm, setClassForm] = useState({ grade_level: "", section: "" });
  const [multiForm, setMultiForm] = useState({ grade_level: "", type: "alpha", from: "A", to: "C" });
  const [savingClass, setSavingClass] = useState(false);
  const [deletingClass, setDeletingClass] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOpen = open;
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
        if (!classForm.grade_level.trim()) throw new Error("Class level is required.");
        const sectionVal = classForm.section?.startsWith("custom_") ? "" : classForm.section;

        const isDuplicate = branchClasses.some(
          (c) => c.id !== editingClass.id &&
                 c.grade_level === classForm.grade_level &&
                 ((sectionVal && c.section === sectionVal) || (!sectionVal && !c.section))
        );

        if (isDuplicate) {
          const displayName = sectionVal
            ? `Class ${classForm.grade_level} - Section ${sectionVal}`
            : `Class ${classForm.grade_level}`;
          throw new Error(`${displayName} already exists. Choose another name.`);
        }

        const computedName = sectionVal ? `${classForm.grade_level} - ${sectionVal}` : classForm.grade_level;

        await managerService.updateClass(editingClass.id, {
          name: computedName,
          grade_level: classForm.grade_level,
          section: sectionVal || null,
        });
        toast.success("Class updated!");
      } else {
        if (creationMode === "single") {
          if (!classForm.grade_level.trim()) throw new Error("Class level is required.");
          const sectionVal = classForm.section?.startsWith("custom_") ? "" : classForm.section;

          // Check if class (grade level) already exists
          const classExists = branchClasses.some((c) => c.grade_level === classForm.grade_level);
          if (classExists) {
            throw new Error(`Class ${classForm.grade_level} already exists. Please choose a different class level.`);
          }

          const isDuplicate = branchClasses.some(
            (c) => c.grade_level === classForm.grade_level &&
                   ((sectionVal && c.section === sectionVal) || (!sectionVal && !c.section))
          );

          if (isDuplicate) {
            const displayName = sectionVal
              ? `Class ${classForm.grade_level} - Section ${sectionVal}`
              : `Class ${classForm.grade_level}`;
            throw new Error(`${displayName} already exists. Choose another name.`);
          }

          const computedName = sectionVal ? `${classForm.grade_level} - ${sectionVal}` : classForm.grade_level;

          await managerService.createClass({
            branch_id: branch.id,
            name: computedName,
            grade_level: classForm.grade_level,
            section: sectionVal || null,
          });
          toast.success("Class created!");
        } else {
          if (!multiForm.grade_level.trim()) throw new Error("Class level is required.");

          // Check if class (grade level) already exists
          const classExists = branchClasses.some((c) => c.grade_level === multiForm.grade_level);
          if (classExists) {
            throw new Error(`Class ${multiForm.grade_level} already exists. Please choose a different class level.`);
          }

          const range = getRange(multiForm.type, multiForm.from, multiForm.to);
          if (range.length === 0) throw new Error("Invalid range selected.");
          if (range.length > 50) throw new Error("Cannot create more than 50 classes at once.");

          const existingSections = branchClasses
            .filter((c) => c.grade_level === multiForm.grade_level)
            .map((c) => c.section)
            .filter(Boolean);

          const duplicates = range.filter((sec) => existingSections.includes(sec));
          if (duplicates.length > 0) {
            throw new Error(
              `Section(s) "${duplicates.join(", ")}" already exist in Class ${multiForm.grade_level}. ` +
              `Choose different names.`
            );
          }

          await Promise.all(
            range.map((sec) => {
              const name = `${multiForm.grade_level} - ${sec}`;
              return managerService.createClass({
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
      await managerService.deleteClass(deletingClass.id);
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
            <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              <UsersIcon className="h-3.5 w-3.5" />
              {branchStudentTotal}
            </span>
          </div>
        </button>

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
                  onManageSections={openManageSections}
                  onLinkSubjects={(c) => setLinkSubjectsFor(c)}
                  branchName={branch.name}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
        allSections={linkSubjectsFor ? branchClasses.filter((c) => c.grade_level === linkSubjectsFor.grade_level) : []}
        onClose={() => setLinkSubjectsFor(null)}
        onSaved={() => { setLinkSubjectsFor(null); onRefresh(); }}
      />
    </div>
  );
}

export default function ManagerSchools() {
  const { user } = useAuth();
  const [school, setSchool] = useState(null);
  const [branches, setBranches] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [branchForm, setBranchForm] = useState({ name: "", city: "", address: "" });
  const [savingBranch, setSavingBranch] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const schoolsRes = await managerService.getSchools();
      const schoolsData = schoolsRes.data;

      if (Array.isArray(schoolsData) && schoolsData.length > 0) {
        setSchool(schoolsData[0]);

        const branchesRes = await managerService.getSchoolBranches(schoolsData[0].id);
        const branchesData = branchesRes.data?.data || branchesRes.data || [];
        setBranches(Array.isArray(branchesData) ? branchesData : []);

        const classesRes = await managerService.getClasses();
        const classesData = classesRes.data?.data || classesRes.data || [];
        setAllClasses(Array.isArray(classesData) ? classesData : []);
      }
    } catch {
      toast.error("Failed to load school data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddBranch = () => {
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
        await managerService.updateBranch(editingBranch.id, payload);
        toast.success("Branch updated!");
      } else {
        await managerService.createBranch(payload);
        toast.success("Branch created!");
      }
      setShowBranchModal(false);
      loadData();
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
      await managerService.deleteBranch(deletingBranch.id);
      toast.success("Branch deleted.");
      setDeletingBranch(null);
      loadData();
    } catch {
      toast.error("Failed to delete branch.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (!school) return <div className="p-6 text-center text-gray-500">No school assigned.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      {/* School Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{school.address}</p>
      </div>

      {/* Branches */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Branches</h2>
          <button
            onClick={openAddBranch}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-sm font-semibold transition-colors"
          >
            <PlusIcon className="h-4 w-4" /> Branch
          </button>
        </div>

        {branches.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No branches yet.{" "}
            <button onClick={openAddBranch} className="text-indigo-600 hover:underline">
              Create one →
            </button>
          </div>
        ) : (
          branches.map((branch) => {
            const branchClasses = allClasses.filter((c) => c.branch_id === branch.id);
            return (
              <BranchPanel
                key={branch.id}
                branch={branch}
                branchClasses={branchClasses}
                onEdit={openEditBranch}
                onDelete={setDeletingBranch}
                onRefresh={loadData}
              />
            );
          })
        )}
      </div>

      {/* Branch Modal */}
      <Modal
        isOpen={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        title={editingBranch ? "Edit Branch" : "Add Branch"}
      >
        <form onSubmit={handleSaveBranch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch Name <span className="text-red-500">*</span>
            </label>
            <input
              value={branchForm.name}
              onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Main Campus, North Branch"
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
              placeholder="e.g., Lahore"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              value={branchForm.address}
              onChange={(e) => setBranchForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Full address"
              required
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowBranchModal(false)}
              disabled={savingBranch}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingBranch}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {savingBranch && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {savingBranch ? "Saving…" : (editingBranch ? "Save Changes" : "Create Branch")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteModal
        isOpen={!!deletingBranch}
        onClose={() => setDeletingBranch(null)}
        onConfirm={confirmDeleteBranch}
        deleting={isDeleting}
        title="Delete Branch"
        message="Are you sure you want to delete this branch? All classes, sections, and enrollments will be lost."
      />
    </div>
  );
}
