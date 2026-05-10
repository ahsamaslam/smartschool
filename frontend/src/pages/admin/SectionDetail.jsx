import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import libraryService from "../../services/libraryService";
import { PageSpinner } from "../../components/common/Spinner";
import toast from "react-hot-toast";
import {
  AcademicCapIcon,
  BookOpenIcon,
  ChevronRightIcon,
  UsersIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";

export default function SectionDetail() {
  const { sectionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const [curriculum, setCurriculum] = useState(null);
  const [loading, setLoading] = useState(true);

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
  const backToClassPath = state?.returnToClassPath || (state?.classId ? `/admin/classes/${state.classId}` : null);
  const goBackToClass = () => {
    if (backToClassPath) {
      navigate(backToClassPath, {
        state: {
          branchId: state?.branchId,
          gradeLevel,
          branchName,
          schoolName,
        },
      });
      return;
    }
    navigate("/admin/schools");
  };

  // Group books by subject_id
  const booksBySubject = {};
  (curriculum?.books || []).forEach((book) => {
    const sid = book.subject_id;
    if (!booksBySubject[sid]) booksBySubject[sid] = [];
    booksBySubject[sid].push(book);
  });

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6 flex-wrap">
        <Link to="/admin/schools" className="hover:text-gray-700 transition-colors">Schools</Link>
        {schoolName && (
          <>
            <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{schoolName}</span>
          </>
        )}
        {branchName && (
          <>
            <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{branchName}</span>
          </>
        )}
        {gradeLevel && (
          <>
            <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <button onClick={goBackToClass} className="hover:text-gray-700 transition-colors">
              Class {gradeLevel}
            </button>
          </>
        )}
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
                  <span className="text-xs bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-semibold">
                    {curriculum.board_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {(curriculum.subjects || []).length} subject{(curriculum.subjects || []).length !== 1 ? "s" : ""} ·{" "}
                    {(curriculum.books || []).length} book{(curriculum.books || []).length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={goBackToClass}
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
          <button
            onClick={goBackToClass}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            ← Go back to assign a course
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
                {/* Subject header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <BookOpenIcon className="h-4 w-4 text-indigo-600" />
                  </div>
                  <h2 className="font-semibold text-gray-900 flex-1">{subject.name}</h2>
                  <span className="text-xs text-gray-400">
                    {books.length} book{books.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Books list */}
                {books.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400">
                    No books assigned for this subject.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {books.map((book) => (
                      <div
                        key={book.id}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/admin/library/books/${book.id}`, {
                          state: { subjectName: subject.name },
                        })}
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <BookOpenIcon className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                            {book.title}
                          </p>
                          {book.author && (
                            <p className="text-xs text-gray-400 mt-0.5">by {book.author}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/library/books/${book.id}`, {
                                state: { subjectName: subject.name },
                              });
                            }}
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
    </div>
  );
}
