import { Link, useParams } from "react-router-dom";
import { BookOpenIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import CourseContextHeader from "../../components/student/CourseContextHeader";
import useStudentLearningTree from "../../hooks/useStudentLearningTree";
import {
  findEnrollment,
  findBoard,
  findSubject,
  rollupBook,
  pathToBook,
} from "../../utils/studentCourseNavigation";

export default function StudentCourseSubject() {
  const { classId, boardId, subjectId } = useParams();
  const { enrollments, loading, error } = useStudentLearningTree();

  if (loading) return <PageSpinner />;

  const enrollment = findEnrollment(enrollments, classId);
  const board = findBoard(enrollment, boardId);
  const subject = findSubject(board, subjectId);

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert type="error" message={error} />
      </div>
    );
  }

  if (!enrollment || !board || !subject) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert type="warning" message="This subject is not in your curriculum." />
        <Link to="/student/courses" className="text-indigo-600 text-sm font-semibold mt-4 inline-block">
          ← My Courses
        </Link>
      </div>
    );
  }

  const books = subject.books || [];

  return (
    <div className="p-6 max-w-6xl mx-auto pb-16">
      <nav className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-1.5">
        <Link to="/student/courses" className="text-indigo-600 hover:underline font-medium">
          My Courses
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-800 font-medium truncate max-w-[min(60vw,280px)]">{subject.name}</span>
      </nav>

      <CourseContextHeader
        enrollment={enrollment}
        boardName={board.name}
        subtitle="Open a book to see its chapters, then pick a topic for slides and recorded lectures."
      />

      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{subject.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Select a book to continue</p>
        </div>
        <p className="text-xs text-gray-400 shrink-0">{books.length} book{books.length !== 1 ? "s" : ""}</p>
      </div>

      {books.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-10 text-center text-sm text-amber-900">
          No books assigned for this subject in your section yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {books.map((book) => {
            const { chapters, topics } = rollupBook(book);
            return (
              <Link
                key={book.id}
                to={pathToBook(classId, boardId, subjectId, book.id)}
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all flex flex-col min-h-[168px]"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100 group-hover:bg-amber-100">
                    <BookOpenIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 leading-snug group-hover:text-indigo-800 line-clamp-2">
                      {book.title}
                    </p>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 shrink-0 mt-1" />
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 py-2 px-2">
                    <p className="text-lg font-bold tabular-nums text-gray-900">{chapters}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Chapters</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 py-2 px-2">
                    <p className="text-lg font-bold tabular-nums text-gray-900">{topics}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Topics</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
