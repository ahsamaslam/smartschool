import { Link } from "react-router-dom";
import {
  BookOpenIcon,
  ChevronRightIcon,
  PresentationChartBarIcon,
} from "@heroicons/react/24/outline";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import CourseContextHeader from "../../components/student/CourseContextHeader";
import useStudentLearningTree from "../../hooks/useStudentLearningTree";
import { rollupSubject, pathToSubject } from "../../utils/studentCourseNavigation";

export default function MyCourses() {
  const { enrollments, loading, error } = useStudentLearningTree();

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-16">
      <div className="mb-8 md:mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            <PresentationChartBarIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">My Courses</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Your books and topics from your enrolled sections — open a subject to explore.
            </p>
          </div>
        </div>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" />}

      {enrollments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-10 text-center text-gray-500 text-sm max-w-xl">
          You are not enrolled in an active section yet. Ask your administrator to assign you to a
          class.
        </div>
      ) : (
        <div className="space-y-14">
          {enrollments.map((en) => {
            const boards = en.boards || [];
            let totalSubjects = 0;
            for (const b of boards) totalSubjects += (b.subjects || []).length;

            return (
              <section key={en.class_id}>
                <CourseContextHeader
                  enrollment={en}
                  subtitle="Tap a subject card to see its books, then chapters and topics. Each topic can include slides and a recorded lecture."
                />

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center shadow-sm">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{boards.length}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mt-1">
                      Board{boards.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center shadow-sm">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalSubjects}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mt-1">
                      Subject{totalSubjects !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center shadow-sm sm:col-span-2 lg:col-span-1">
                    <p className="text-sm font-medium text-slate-700 leading-snug">
                      Go deeper: Subject → Book → Chapter → Topic
                    </p>
                  </div>
                </div>

                {!boards.length ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-950">
                    No library curriculum linked to this section yet.
                  </div>
                ) : (
                  boards.map((board) => (
                    <div key={board.id} className="mb-10 last:mb-0">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-200 to-transparent max-w-[120px]" />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-700 px-2 shrink-0">
                          Board · {board.name}
                        </h2>
                        <span className="h-px flex-1 bg-gradient-to-r from-indigo-200 via-indigo-100 to-transparent" />
                      </div>

                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {(board.subjects || []).map((sub) => {
                          const { books, chapters, topics } = rollupSubject(sub);
                          return (
                            <Link
                              key={sub.id}
                              to={pathToSubject(en.class_id, board.id, sub.id)}
                              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-200 hover:shadow-lg transition-all duration-200 flex flex-col min-h-[200px]"
                            >
                              <div className="absolute top-0 right-0 h-24 w-24 rounded-bl-full bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />
                              <div className="flex items-start justify-between gap-3 mb-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md group-hover:scale-105 transition-transform">
                                  <BookOpenIcon className="h-6 w-6" />
                                </div>
                                <ChevronRightIcon className="h-6 w-6 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-indigo-900 pr-2">
                                {sub.name}
                              </h3>
                              <p className="text-xs text-gray-500 mt-2 mb-4 flex-1">
                                Open to browse books, chapters, and topics for this subject.
                              </p>
                              <div className="grid grid-cols-3 gap-2 mt-auto pt-2 border-t border-gray-100">
                                <div className="rounded-xl bg-gray-50 border border-gray-100 py-2 px-1 text-center">
                                  <p className="text-base font-bold text-gray-900 tabular-nums">{books}</p>
                                  <p className="text-[9px] font-bold uppercase text-gray-500 tracking-wide">
                                    Books
                                  </p>
                                </div>
                                <div className="rounded-xl bg-gray-50 border border-gray-100 py-2 px-1 text-center">
                                  <p className="text-base font-bold text-gray-900 tabular-nums">{chapters}</p>
                                  <p className="text-[9px] font-bold uppercase text-gray-500 tracking-wide">
                                    Chapters
                                  </p>
                                </div>
                                <div className="rounded-xl bg-gray-50 border border-gray-100 py-2 px-1 text-center">
                                  <p className="text-base font-bold text-gray-900 tabular-nums">{topics}</p>
                                  <p className="text-[9px] font-bold uppercase text-gray-500 tracking-wide">
                                    Topics
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs font-semibold text-indigo-600 mt-3 group-hover:underline">
                                View subject →
                              </p>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
