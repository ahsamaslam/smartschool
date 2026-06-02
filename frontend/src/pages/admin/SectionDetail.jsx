import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import libraryService from "../../services/libraryService";
import { useAuth } from "../../context/AuthContext";
import { PageSpinner } from "../../components/common/Spinner";
import toast from "react-hot-toast";
import {
  AcademicCapIcon,
  BookOpenIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  XMarkIcon,
  ArrowPathIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

// ── Inline modal shell ────────────────────────────────────────────────────────
function Modal({ isOpen, onClose, title, children, wide }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} p-6 relative max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Curriculum assignment modal (same logic as admin Schools) ─────────────────
function ManageCurriculumModal({ isOpen, onClose, section, allSections, onSaved }) {
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
    if (!selectedBoardId || selectedSubjectIds.length === 0) { setSubjectBooks({}); setExpandedSubjects({}); return; }
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
      const map = {}; const expanded = {};
      results.forEach(({ sid, books }) => { map[sid] = books; expanded[sid] = true; });
      setSubjectBooks(map); setExpandedSubjects(expanded);
    }).finally(() => mounted && setLoadingBooks(false));
    return () => { mounted = false; };
  }, [selectedBoardId, selectedSubjectIds.join(",")]); // eslint-disable-line

  const toggleSubject = (id) => setSelectedSubjectIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleBook = (id) => setSelectedBookIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAllForSubject = (sid, visibleBooks) => {
    const ids = visibleBooks.map((b) => b.id);
    const allSel = ids.every((id) => selectedBookIds.includes(id));
    setSelectedBookIds((p) => allSel ? p.filter((id) => !ids.includes(id)) : [...new Set([...p, ...ids])]);
  };

  const handleSave = async () => {
    if (!section?.id || !selectedBoardId) return;
    setSaving(true);
    try {
      if (applyToAll && allSections?.length > 0) {
        await libraryService.bulkAssignSections({ class_ids: allSections.map((s) => s.id), board_id: selectedBoardId, subject_ids: selectedSubjectIds, book_ids: selectedBookIds });
        toast.success(`Course applied to all ${allSections.length} sections.`);
      } else {
        await libraryService.setSectionSubjects(section.id, { board_id: selectedBoardId, subject_ids: selectedSubjectIds });
        await libraryService.setSectionBooks(section.id, { book_ids: selectedBookIds });
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

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose?.()} title={`Manage Curriculum — ${section?.section ? `Sec ${section.section}` : "Section"}`} wide>
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
      ) : boards.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500">No boards configured. Go to Library to set up boards.</div>
      ) : (
        <div className="space-y-4">
          {allSections?.length > 1 && (
            <label className="flex items-center gap-2 p-3 bg-indigo-50 rounded-xl cursor-pointer border border-indigo-100">
              <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} className="rounded" />
              <span className="text-sm font-medium text-indigo-700">Apply to all sections in this class ({allSections.length} sections)</span>
            </label>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Board</label>
            <select value={selectedBoardId} onChange={(e) => setSelectedBoardId(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
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
                <input value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} placeholder="Search books…" className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-40" />
              </div>
              {loadingBooks ? (
                <div className="text-sm text-gray-400 py-3 text-center">Loading books…</div>
              ) : (
                <div className="space-y-3">
                  {selectedSubjectIds.map((sid) => {
                    const subj = subjects.find((s) => s.id === sid);
                    const sBooks = (subjectBooks[sid] || []).filter((b) => !bookSearch || b.title?.toLowerCase().includes(bookSearch.toLowerCase()));
                    if (!subj) return null;
                    return (
                      <div key={sid} className="border border-gray-100 rounded-xl overflow-hidden">
                        <button type="button" onClick={() => setExpandedSubjects((p) => ({ ...p, [sid]: !p[sid] }))} className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100">
                          <span>{subj.name}</span>
                          <div className="flex items-center gap-2">
                            {sBooks.length > 0 && <span onClick={(e) => { e.stopPropagation(); toggleAllForSubject(sid, sBooks); }} className="text-xs text-indigo-600 hover:underline">{sBooks.every((b) => selectedBookIds.includes(b.id)) ? "Deselect all" : "Select all"}</span>}
                            <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-400 transition-transform ${expandedSubjects[sid] ? "rotate-180" : ""}`} />
                          </div>
                        </button>
                        {expandedSubjects[sid] && (
                          <div className="px-3 py-2 space-y-1.5">
                            {sBooks.length === 0 ? <p className="text-xs text-gray-400 px-1 py-2">No books match.</p> : sBooks.map((book) => (
                              <label key={book.id} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedBookIds.includes(book.id) ? "border-indigo-400 bg-indigo-50" : "border-gray-100 hover:border-indigo-200"}`}>
                                <input type="checkbox" checked={selectedBookIds.includes(book.id)} onChange={() => toggleBook(book.id)} className="rounded mt-0.5" />
                                <div><p className="text-sm text-gray-800">{book.title}</p>{book.author && <p className="text-xs text-gray-400">{book.author}</p>}</div>
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
              {saving ? "Saving…" : "Save Curriculum"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function SectionDetail() {
  const { sectionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = location.state || {};

  const [curriculum, setCurriculum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);

  // Determine role-based paths
  const isManager = user?.role === "manager";
  const schoolsPath = isManager ? "/manager/schools" : "/admin/schools";
  const libraryBookPath = (bookId) => isManager ? `/manager/library/books/${bookId}` : `/admin/library/books/${bookId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await libraryService.getSectionCurriculum(sectionId);
      setCurriculum(res?.data?.data || null);
    } catch {
      toast.error("Failed to load section curriculum.");
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSpinner />;

  const { gradeLevel, branchName, schoolName } = state;
  const hasCurriculum = curriculum?.board_name;

  // Group books by subject_id
  const booksBySubject = {};
  (curriculum?.books || []).forEach((book) => {
    const sid = book.subject_id;
    if (!booksBySubject[sid]) booksBySubject[sid] = [];
    booksBySubject[sid].push(book);
  });

  // Build a fake section object for the modal
  const sectionObj = { id: sectionId, section: curriculum?.section_name, grade_level: gradeLevel };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6 flex-wrap">
        <Link to={schoolsPath} className="hover:text-gray-700 transition-colors">Schools</Link>
        {schoolName && (<><ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" /><span>{schoolName}</span></>)}
        {branchName && (<><ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" /><span>{branchName}</span></>)}
        {gradeLevel && (<><ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" /><span>Class {gradeLevel}</span></>)}
        <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-semibold text-gray-900">
          {curriculum?.section_name || `Section ${sectionId.slice(0, 6)}`}
        </span>
      </nav>

      {/* Header */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 mb-6 border border-amber-100">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center flex-shrink-0">
              <AcademicCapIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {gradeLevel ? `Class ${gradeLevel}` : ""}
                {curriculum?.section_name ? ` — ${curriculum.section_name}` : ""}
              </h1>
              {hasCurriculum && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-semibold">{curriculum.board_name}</span>
                  <span className="text-xs text-gray-500">
                    {(curriculum.subjects || []).length} subject{(curriculum.subjects || []).length !== 1 ? "s" : ""} · {(curriculum.books || []).length} book{(curriculum.books || []).length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCurriculumModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-white text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-colors flex-shrink-0"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Manage Curriculum
          </button>
        </div>
      </div>

      {/* No curriculum */}
      {!hasCurriculum && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
          <BookOpenIcon className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium text-gray-500">No curriculum assigned yet</p>
          <button onClick={() => setShowCurriculumModal(true)} className="mt-3 text-sm text-indigo-600 hover:underline">
            Assign a course →
          </button>
        </div>
      )}

      {/* Subjects + Books */}
      {hasCurriculum && (
        <div className="space-y-4">
          {(curriculum.subjects || []).map((subject) => {
            const books = booksBySubject[subject.id] || [];
            return (
              <div key={subject.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <BookOpenIcon className="h-4 w-4 text-indigo-600" />
                  </div>
                  <h2 className="font-semibold text-gray-900 flex-1">{subject.name}</h2>
                  <span className="text-xs text-gray-400">{books.length} book{books.length !== 1 ? "s" : ""}</span>
                </div>
                {books.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400">No books assigned for this subject.</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {books.map((book) => (
                      <div
                        key={book.id}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                        onClick={() => navigate(libraryBookPath(book.id), { state: { subjectName: subject.name } })}
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <BookOpenIcon className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{book.title}</p>
                          {book.author && <p className="text-xs text-gray-400 mt-0.5">by {book.author}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(libraryBookPath(book.id), { state: { subjectName: subject.name } }); }}
                            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all"
                          >
                            <ChevronRightIcon className="h-3 w-3" />
                            Open
                          </button>
                          <ChevronRightIcon className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ManageCurriculumModal
        isOpen={showCurriculumModal}
        onClose={() => setShowCurriculumModal(false)}
        section={sectionObj}
        allSections={[sectionObj]}
        onSaved={() => { setShowCurriculumModal(false); load(); }}
      />
    </div>
  );
}
