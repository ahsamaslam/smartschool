import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import adminService from "../../services/adminService";
import libraryService from "../../services/libraryService";
import Spinner from "../../components/common/Spinner";
import toast from "react-hot-toast";
import {
  AcademicCapIcon,
  PlusIcon,
  UsersIcon,
  BookOpenIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

const ALPHA = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const NUM = Array.from({ length: 30 }, (_, i) => String(i + 1));

// ── Shared Modal Shell ────────────────────────────────────────────────────────
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

// ── Section Picker ─────────────────────────────────────────────────────────────
function SectionSelect({ value, onChange }) {
  const isCustom = value && !ALPHA.includes(value) && !NUM.includes(value) && value !== "";
  const selectValue = isCustom ? "custom" : value;

  return (
    <div className="space-y-2">
      <select
        value={selectValue}
        onChange={(e) =>
          onChange(e.target.value === "custom" ? "__custom__" : e.target.value)
        }
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      >
        <option value="">No Section (Main)</option>
        <optgroup label="Alphabets (A–Z)">
          {ALPHA.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </optgroup>
        <optgroup label="Numbers (1–30)">
          {NUM.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </optgroup>
        <option value="custom">Custom…</option>
      </select>
      {(value === "__custom__" || isCustom) && (
        <input
          autoFocus
          placeholder="Type section name…"
          value={isCustom ? value : ""}
          onChange={(e) => onChange(e.target.value || "__custom__")}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      )}
    </div>
  );
}

// ── Assign Curriculum Modal ────────────────────────────────────────────────────
function AssignCurriculumModal({ isOpen, onClose, section, allSections, onSaved, forceAll }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [selectedBookIds, setSelectedBookIds] = useState([]);
  const [subjectBooks, setSubjectBooks] = useState({});
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [applyToAll, setApplyToAll] = useState(forceAll || false);
  const [bookSearch, setBookSearch] = useState("");
  const [expandedSubjects, setExpandedSubjects] = useState({});

  const boards = catalog?.boards || [];
  const linkedByBoard = catalog?.linked_subjects_by_board || {};
  const activeBoard = boards.find((b) => b.id === selectedBoardId);
  const subjects = activeBoard?.subjects || [];

  useEffect(() => {
    setApplyToAll(forceAll || false);
  }, [forceAll]);

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
        const firstId = data?.boards?.[0]?.id || "";
        setSelectedBoardId(firstId);
        setSelectedSubjectIds(firstId ? data?.linked_subjects_by_board?.[firstId] || [] : []);
      })
      .catch(() => toast.error("Failed to load subject catalog."))
      .finally(() => mounted && setLoading(false));
    // Pre-load assigned books
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

  // Load books whenever subject selection changes
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
        toast.success(`Curriculum applied to all ${allSections.length} sections.`);
      } else {
        await libraryService.setSectionSubjects(section.id, {
          board_id: selectedBoardId,
          subject_ids: selectedSubjectIds,
        });
        await libraryService.setSectionBooks(section.id, {
          book_ids: selectedBookIds,
        });
        toast.success("Curriculum updated.");
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update curriculum.");
    } finally {
      setSaving(false);
    }
  };

  const sectionLabel = section?.section ? `Section ${section.section}` : "Main Section";
  const allBooks = Object.values(subjectBooks).flat();

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose?.()} title={`Manage Curriculum — ${sectionLabel}`} wide>
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
      ) : boards.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">
          No boards configured yet.{" "}
          <Link to="/admin/library" className="text-indigo-600 hover:underline">
            Go to Library →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Apply to all toggle */}
          <label className="flex items-center gap-2 p-3 bg-indigo-50 rounded-xl cursor-pointer border border-indigo-100">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-indigo-700">
              Apply to all sections in this class ({allSections?.length || 0} sections)
            </span>
          </label>

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
                <Link to="/admin/library" className="text-indigo-600 hover:underline">
                  Add subjects in Library →
                </Link>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-2 space-y-1">
                {subjects.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
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
                  <Link to="/admin/ai-parser" className="text-indigo-600 hover:underline">
                    Add books via AI Parser →
                  </Link>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    placeholder="Search books…"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
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
              {saving ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
              {saving ? "Saving…" : applyToAll ? "Apply to All Sections" : "Save"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ section, curriculum, onManageCurriculum, onEdit, onDelete, onView }) {
  const label = section.section ? `Section ${section.section}` : "Main Section";
  const hasCurriculum = curriculum?.board_name;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-md transition-all group cursor-pointer"
      onClick={() => onView(section)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AcademicCapIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{label}</p>
            {section.teacher_name && (
              <p className="text-xs text-gray-400 mt-0.5">
                Teacher: {section.teacher_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(section); }}
            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50"
            title="Edit section"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(section); }}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
            title="Delete section"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
        <UsersIcon className="h-3.5 w-3.5" />
        <span>{section.student_count ?? 0} students</span>
      </div>

      {/* Curriculum summary */}
      {hasCurriculum ? (
        <div className="mb-3 p-2.5 bg-indigo-50 rounded-xl">
          <p className="text-xs font-semibold text-indigo-700 mb-1">{curriculum.board_name}</p>
          <p className="text-xs text-indigo-600">
            {(curriculum.subjects || []).map((s) => s.name).join(", ") || "No subjects"}
          </p>
          {(curriculum.books || []).length > 0 && (
            <p className="text-xs text-indigo-500 mt-0.5">
              {curriculum.books.length} book{curriculum.books.length !== 1 ? "s" : ""} assigned
            </p>
          )}
        </div>
      ) : (
        <div className="mb-3 p-2.5 bg-gray-50 rounded-xl">
          <p className="text-xs text-gray-400">No curriculum assigned</p>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onManageCurriculum(section); }}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-indigo-200 text-indigo-700 text-sm font-medium hover:bg-indigo-50 transition-colors"
      >
        <BookOpenIcon className="h-4 w-4" />
        Manage Curriculum
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminClassDetail() {
  const { classId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const stateData = location.state || {};

  const [sections, setSections] = useState([]);
  const [sectionCurricula, setSectionCurricula] = useState({});
  const [branchId, setBranchId] = useState(stateData.branchId || "");
  const [gradeLevel, setGradeLevel] = useState(stateData.gradeLevel || "");
  const [branchName, setBranchName] = useState(stateData.branchName || "");
  const [schoolName, setSchoolName] = useState(stateData.schoolName || "");
  const [loading, setLoading] = useState(true);

  // Modals
  const [curriculumFor, setCurriculumFor] = useState(null);
  const [forceAll, setForceAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSection, setAddSection] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editSection, setEditSection] = useState("");
  const [editStudentCount, setEditStudentCount] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingSection, setDeletingSection] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCurricula = useCallback(async (secs) => {
    if (!secs || secs.length === 0) return;
    const results = await Promise.all(
      secs.map((s) =>
        libraryService
          .getSectionCurriculum(s.id)
          .then((res) => ({ id: s.id, data: res?.data?.data || {} }))
          .catch(() => ({ id: s.id, data: {} }))
      )
    );
    const map = {};
    results.forEach(({ id, data }) => { map[id] = data; });
    setSectionCurricula(map);
  }, []);

  const loadSections = useCallback(
    async (bId, gl) => {
      if (!bId) return;
      setLoading(true);
      try {
        const res = await adminService.getBranchClasses(bId);
        const raw = res.data;
        const all = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        const filtered = all.filter((c) => c.grade_level === gl);
        setSections(filtered);
        loadCurricula(filtered);
      } catch {
        toast.error("Failed to load sections.");
      } finally {
        setLoading(false);
      }
    },
    [loadCurricula]
  );

  useEffect(() => {
    if (stateData.branchId && stateData.gradeLevel) {
      loadSections(stateData.branchId, stateData.gradeLevel);
    } else {
      adminService
        .getAllSchoolData()
        .then((res) => {
          const raw = res.data?.data || res.data || {};
          const allClasses = Array.isArray(raw.classes) ? raw.classes : [];
          const cls = allClasses.find((c) => c.id === classId);
          if (!cls) {
            toast.error("Class not found.");
            setLoading(false);
            return;
          }
          const branch = (raw.branches || []).find((b) => b.id === cls.branch_id);
          const school = (raw.schools || []).find((s) => s.id === branch?.school_id);
          setBranchId(cls.branch_id);
          setGradeLevel(cls.grade_level);
          setBranchName(branch?.name || "");
          setSchoolName(school?.name || "");
          const filtered = allClasses.filter(
            (c) => c.branch_id === cls.branch_id && c.grade_level === cls.grade_level
          );
          setSections(filtered);
          loadCurricula(filtered);
          setLoading(false);
        })
        .catch(() => {
          toast.error("Failed to load class data.");
          setLoading(false);
        });
    }
  }, [classId]); // eslint-disable-line

  const resolvedSection = (raw) =>
    raw === "__custom__" ? "" : raw?.startsWith("__custom__") ? raw.slice(10) : raw;

  const handleAddSection = async (e) => {
    e.preventDefault();
    const sec = resolvedSection(addSection);
    const name = sec ? `${gradeLevel} - ${sec}` : gradeLevel;
    setSavingAdd(true);
    try {
      await adminService.createClass({
        branch_id: branchId,
        name,
        grade_level: gradeLevel,
        section: sec || null,
      });
      toast.success("Section added.");
      setShowAddModal(false);
      setAddSection("");
      loadSections(branchId, gradeLevel);
    } catch {
      toast.error("Failed to add section.");
    } finally {
      setSavingAdd(false);
    }
  };

  const handleEditSection = async (e) => {
    e.preventDefault();
    if (!editingSection) return;
    const sec = resolvedSection(editSection);
    const name = sec ? `${gradeLevel} - ${sec}` : gradeLevel;
    setSavingEdit(true);
    try {
      await adminService.updateClass(editingSection.id, {
        name,
        grade_level: gradeLevel,
        section: sec || null,
        ...(editStudentCount !== ""
          ? { student_count: parseInt(editStudentCount, 10) }
          : {}),
      });
      toast.success("Section updated.");
      setEditingSection(null);
      loadSections(branchId, gradeLevel);
    } catch {
      toast.error("Failed to update section.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!deletingSection) return;
    setIsDeleting(true);
    try {
      await adminService.deleteClass(deletingSection.id);
      toast.success("Section deleted.");
      setDeletingSection(null);
      loadSections(branchId, gradeLevel);
    } catch {
      toast.error("Failed to delete section.");
    } finally {
      setIsDeleting(false);
    }
  };

  const openEdit = (sec) => {
    setEditingSection(sec);
    setEditSection(sec.section || "");
    setEditStudentCount(String(sec.student_count ?? ""));
  };

  const openCurriculumModal = (sec, all = false) => {
    setForceAll(all);
    setCurriculumFor(sec);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[50vh] gap-4 text-gray-500">
        <Spinner size="lg" />
        <p className="text-sm">Loading sections…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6 flex-wrap">
        <Link to="/admin/schools" className="hover:text-gray-700 transition-colors">
          Schools
        </Link>
        {schoolName && (
          <>
            <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-gray-500">{schoolName}</span>
          </>
        )}
        {branchName && (
          <>
            <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-gray-500">{branchName}</span>
          </>
        )}
        {gradeLevel && (
          <>
            <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-semibold text-gray-900">Class {gradeLevel}</span>
          </>
        )}
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class {gradeLevel}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {sections.length} section{sections.length !== 1 ? "s" : ""}
            {branchName ? ` · ${branchName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sections.length > 0 && (
            <button
              onClick={() => openCurriculumModal(sections[0], true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-200 text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-50 transition-colors"
            >
              <BookOpenIcon className="h-4 w-4" />
              Assign to All Sections
            </button>
          )}
          <button
            onClick={() => {
              setAddSection("");
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Add Section
          </button>
        </div>
      </div>

      {/* Sections Grid */}
      {sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <AcademicCapIcon className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">No sections yet.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            Add the first section →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((sec) => (
            <SectionCard
              key={sec.id}
              section={sec}
              curriculum={sectionCurricula[sec.id]}
              onManageCurriculum={(s) => openCurriculumModal(s, false)}
              onEdit={openEdit}
              onDelete={setDeletingSection}
              onView={(s) => navigate(`/admin/sections/${s.id}`, {
                state: { gradeLevel, branchName, schoolName, branchId },
              })}
            />
          ))}
        </div>
      )}

      {/* ── Add Section Modal ── */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`Add Section — Class ${gradeLevel}`}
      >
        <form onSubmit={handleAddSection} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <SectionSelect value={addSection} onChange={setAddSection} />
          </div>
          <button
            type="submit"
            disabled={savingAdd}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {savingAdd ? "Adding…" : "Add Section"}
          </button>
        </form>
      </Modal>

      {/* ── Edit Section Modal ── */}
      <Modal
        isOpen={!!editingSection}
        onClose={() => setEditingSection(null)}
        title="Edit Section"
      >
        <form onSubmit={handleEditSection} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <SectionSelect value={editSection} onChange={setEditSection} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Students
            </label>
            <input
              type="number"
              min="0"
              value={editStudentCount}
              onChange={(e) => setEditStudentCount(e.target.value)}
              placeholder="e.g. 35"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingEdit}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {savingEdit ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </Modal>

      {/* ── Confirm Delete Modal ── */}
      <Modal
        isOpen={!!deletingSection}
        onClose={() => setDeletingSection(null)}
        title="Delete Section"
      >
        <p className="text-sm text-gray-600 mb-6">
          Delete{" "}
          <strong>
            {deletingSection?.section
              ? `Section ${deletingSection.section}`
              : "this section"}
          </strong>
          ? All enrollments and data linked to this section will be permanently lost.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeletingSection(null)}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteSection}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-2 transition-colors"
          >
            {isDeleting ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <TrashIcon className="h-4 w-4" />
            )}
            Delete
          </button>
        </div>
      </Modal>

      {/* ── Assign Curriculum Modal ── */}
      <AssignCurriculumModal
        isOpen={!!curriculumFor}
        section={curriculumFor}
        allSections={sections}
        forceAll={forceAll}
        onClose={() => { setCurriculumFor(null); setForceAll(false); }}
        onSaved={() => loadSections(branchId, gradeLevel)}
      />
    </div>
  );
}
