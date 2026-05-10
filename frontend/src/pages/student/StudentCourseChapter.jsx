import { Link, useParams } from "react-router-dom";
import {
  PresentationChartBarIcon,
  PlayCircleIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import CourseContextHeader from "../../components/student/CourseContextHeader";
import useStudentLearningTree from "../../hooks/useStudentLearningTree";
import {
  findEnrollment,
  findBoard,
  findSubject,
  findBook,
  findChapter,
  pathToSubject,
  pathToBook,
} from "../../utils/studentCourseNavigation";

export default function StudentCourseChapter() {
  const { classId, boardId, subjectId, bookId, chapterId } = useParams();
  const { enrollments, loading, error } = useStudentLearningTree();

  if (loading) return <PageSpinner />;

  const enrollment = findEnrollment(enrollments, classId);
  const board = findBoard(enrollment, boardId);
  const subject = findSubject(board, subjectId);
  const book = findBook(subject, bookId);
  const chapter = findChapter(book, chapterId);

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert type="error" message={error} />
      </div>
    );
  }

  if (!enrollment || !board || !subject || !book || !chapter) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert type="warning" message="This chapter is not in your curriculum." />
        <Link to="/student/courses" className="text-indigo-600 text-sm font-semibold mt-4 inline-block">
          ← My Courses
        </Link>
      </div>
    );
  }

  const topics = chapter.topics || [];

  return (
    <div className="p-6 max-w-6xl mx-auto pb-16">
      <nav className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-1.5">
        <Link to="/student/courses" className="text-indigo-600 hover:underline font-medium">
          My Courses
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          to={pathToSubject(classId, boardId, subjectId)}
          className="text-indigo-600 hover:underline font-medium truncate max-w-[min(26vw,120px)] sm:max-w-[160px]"
        >
          {subject.name}
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          to={pathToBook(classId, boardId, subjectId, bookId)}
          className="text-indigo-600 hover:underline font-medium truncate max-w-[min(32vw,160px)] sm:max-w-[200px]"
        >
          {book.title}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-800 font-medium truncate max-w-[min(36vw,200px)]">
          Ch. {chapter.chapter_number}
        </span>
      </nav>

      <CourseContextHeader
        enrollment={enrollment}
        boardName={board.name}
        subtitle={`${subject.name} · ${book.title} · Use View slides or View recorded lecture; greyed buttons mean that material is not available yet.`}
      />

      <div className="rounded-2xl border border-teal-100 bg-teal-50/35 p-4 md:p-5 mb-8">
        <p className="text-xs font-bold uppercase text-teal-800 tracking-wide mb-1">Chapter</p>
        <p className="text-lg md:text-xl font-bold text-gray-900">
          <span className="text-teal-700 mr-2">Ch. {chapter.chapter_number ?? "—"}</span>
          {chapter.title}
        </p>
        <p className="text-sm text-teal-900/75 mt-1">
          {topics.length} learning topic{topics.length !== 1 ? "s" : ""}
        </p>
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-4">Topics</h2>

      {topics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          No topics in this chapter yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {topics.map((t) => {
            const learnPath = `/student/learn/topic/${t.id}`;
            return (
              <div
                key={t.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-4 hover:border-teal-200/80 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-gray-900 text-base leading-snug">{t.title}</h3>
                </div>
                <div className="mt-auto flex flex-col sm:flex-row flex-wrap gap-2 pt-1">
                  {t.has_slides ? (
                    <Link
                      to={`${learnPath}#slides`}
                      className="inline-flex flex-1 min-w-[10rem] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                      <PresentationChartBarIcon className="h-4 w-4 shrink-0" />
                      View slides
                      <ChevronRightIcon className="h-4 w-4 shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="No slides for this topic yet"
                      className="inline-flex flex-1 min-w-[10rem] cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-400"
                    >
                      <PresentationChartBarIcon className="h-4 w-4 shrink-0 opacity-60" />
                      View slides
                    </button>
                  )}
                  {t.has_lecture ? (
                    <Link
                      to={`${learnPath}#lecture`}
                      className="inline-flex flex-1 min-w-[10rem] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <PlayCircleIcon className="h-4 w-4 shrink-0" />
                      View recorded lecture
                      <ChevronRightIcon className="h-4 w-4 shrink-0" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="No recorded lecture yet"
                      className="inline-flex flex-1 min-w-[10rem] cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-400"
                    >
                      <PlayCircleIcon className="h-4 w-4 shrink-0 opacity-60" />
                      View recorded lecture
                    </button>
                  )}
                </div>
                <Link
                  to={learnPath}
                  className="text-center text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                >
                  Open full topic (progress &amp; all materials)
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
