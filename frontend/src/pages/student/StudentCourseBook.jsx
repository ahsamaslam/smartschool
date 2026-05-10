import { Link, useParams } from "react-router-dom";
import { Square3Stack3DIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import CourseContextHeader from "../../components/student/CourseContextHeader";
import useStudentLearningTree from "../../hooks/useStudentLearningTree";
import {
  findEnrollment,
  findBoard,
  findSubject,
  findBook,
  pathToSubject,
  pathToChapter,
} from "../../utils/studentCourseNavigation";

export default function StudentCourseBook() {
  const { classId, boardId, subjectId, bookId } = useParams();
  const { enrollments, loading, error } = useStudentLearningTree();

  if (loading) return <PageSpinner />;

  const enrollment = findEnrollment(enrollments, classId);
  const board = findBoard(enrollment, boardId);
  const subject = findSubject(board, subjectId);
  const book = findBook(subject, bookId);

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert type="error" message={error} />
      </div>
    );
  }

  if (!enrollment || !board || !subject || !book) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert type="warning" message="This book is not in your curriculum." />
        <Link to="/student/courses" className="text-indigo-600 text-sm font-semibold mt-4 inline-block">
          ← My Courses
        </Link>
      </div>
    );
  }

  const chapters = book.chapters || [];

  return (
    <div className="p-6 max-w-6xl mx-auto pb-16">
      <nav className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-1.5">
        <Link to="/student/courses" className="text-indigo-600 hover:underline font-medium">
          My Courses
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          to={pathToSubject(classId, boardId, subjectId)}
          className="text-indigo-600 hover:underline font-medium truncate max-w-[min(28vw,140px)] sm:max-w-[200px]"
        >
          {subject.name}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-800 font-medium truncate max-w-[min(40vw,220px)]">{book.title}</span>
      </nav>

      <CourseContextHeader
        enrollment={enrollment}
        boardName={board.name}
        subtitle={`${subject.name} · Choose a chapter to see topics, slides, and lectures.`}
      />

      <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 mb-8">
        <p className="text-xs font-semibold uppercase text-violet-700 tracking-wide mb-1">Book</p>
        <p className="text-xl font-bold text-gray-900">{book.title}</p>
        <p className="text-sm text-violet-900/80 mt-1">
          {chapters.length} chapter{chapters.length !== 1 ? "s" : ""} in this book
        </p>
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-4">Chapters</h2>

      {chapters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          No chapters in this book yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapters.map((ch) => {
            const n = ch.topics?.length || 0;
            return (
              <Link
                key={ch.id}
                to={pathToChapter(classId, boardId, subjectId, bookId, ch.id)}
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-violet-200 hover:shadow-md transition-all flex gap-4"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100 group-hover:bg-violet-100">
                  <Square3Stack3DIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-violet-600 uppercase tracking-wide">
                    Chapter {ch.chapter_number ?? "—"}
                  </p>
                  <p className="font-semibold text-gray-900 mt-0.5 leading-snug line-clamp-2 group-hover:text-violet-900">
                    {ch.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{n} topic{n !== 1 ? "s" : ""}</p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-gray-300 group-hover:text-violet-500 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
