import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BookOpenIcon,
  ChevronRightIcon,
  Square3Stack3DIcon,
  PresentationChartBarIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";
import CourseContextHeader from "../student/CourseContextHeader";
import {
  findBoard,
  findSubject,
  findBook,
  findChapter,
  rollupSubject,
  rollupBook,
} from "../../utils/studentCourseNavigation";

/**
 * Same Subject → Book → Chapter → Topics card flow as /student/courses, for admin preview
 * (no student JWT required). Topics open Library slide presentation.
 */
export default function AdminStudentCurriculumExplorer({ boards = [], active }) {
  /** @type {['subjects'|'books'|'chapters'|'topics', string?, string?, string?, string?]} */
  const [step, setStep] = useState(["subjects"]);

  const fauxEnrollment = useMemo(
    () => ({
      class_id: active?.class_id,
      class_name: active?.class_name,
      grade_level: active?.grade_level,
      section: active?.section,
    }),
    [active],
  );

  const treeRoot = useMemo(() => ({ boards }), [boards]);

  const boardId = step[1];
  const subjectId = step[2];
  const bookId = step[3];
  const chapterId = step[4];

  const board = boardId ? findBoard(treeRoot, boardId) : null;
  const subject = board && subjectId ? findSubject(board, subjectId) : null;
  const book = subject && bookId ? findBook(subject, bookId) : null;
  const chapter = book && chapterId ? findChapter(book, chapterId) : null;

  const goSubjects = () => setStep(["subjects"]);
  const goBooks = (bid, sid) => setStep(["books", bid, sid]);

  return (
    <div className="space-y-6">
      <nav className="text-sm text-gray-500 flex flex-wrap items-center gap-1.5 mb-2">
        <button
          type="button"
          onClick={goSubjects}
          className="text-indigo-600 hover:underline font-medium"
        >
          Curriculum
        </button>
        {subject && (
          <>
            <span className="text-gray-300">/</span>
            <button
              type="button"
              onClick={() => goBooks(board.id, subject.id)}
              className="text-indigo-600 hover:underline font-medium truncate max-w-[200px]"
            >
              {subject.name}
            </button>
          </>
        )}
        {book && (
          <>
            <span className="text-gray-300">/</span>
            <button
              type="button"
              onClick={() =>
                setStep(["chapters", board.id, subject.id, book.id])
              }
              className="text-indigo-600 hover:underline font-medium truncate max-w-[200px]"
            >
              {book.title}
            </button>
          </>
        )}
        {chapter && (
          <>
            <span className="text-gray-300">/</span>
            <span className="text-gray-800 font-medium truncate max-w-[160px]">
              Ch. {chapter.chapter_number}
            </span>
          </>
        )}
      </nav>

      {step[0] === "subjects" && (
        <>
          <CourseContextHeader
            enrollment={fauxEnrollment}
            boardName={null}
            subtitle="Tap a subject → book → chapter. Use View slides / View recorded lecture on each topic; disabled buttons mean that material is not uploaded yet."
          />
          {(boards || []).length === 0 ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              No library curriculum linked to this section.
            </p>
          ) : (
            (boards || []).map((bd) => (
              <section key={bd.id} className="mb-10 last:mb-0">
                <div className="flex items-center gap-2 mb-4">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-200 to-transparent max-w-[100px]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-700 px-2 shrink-0">
                    Board · {bd.name}
                  </h3>
                  <span className="h-px flex-1 bg-gradient-to-r from-indigo-200 via-indigo-100 to-transparent" />
                </div>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {(bd.subjects || []).map((sub) => {
                    const stats = rollupSubject(sub);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => goBooks(bd.id, sub.id)}
                        className="text-left rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
                            <BookOpenIcon className="h-5 w-5" />
                          </div>
                          <ChevronRightIcon className="h-6 w-6 text-gray-300 group-hover:text-indigo-500" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 leading-tight mb-3">
                          {sub.name}
                        </h4>
                        <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                          {["books", "chapters", "topics"].map((k) => (
                            <div
                              key={k}
                              className="rounded-xl bg-gray-50 border border-gray-100 py-2 text-center"
                            >
                              <p className="text-base font-bold text-gray-900 tabular-nums">
                                {stats[k]}
                              </p>
                              <p className="text-[9px] font-bold uppercase text-gray-500">{k}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs font-semibold text-indigo-600 mt-3">Open subject →</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {step[0] === "books" && board && subject && (
        <>
          <CourseContextHeader
            enrollment={fauxEnrollment}
            boardName={board.name}
            subtitle={`${subject.name} — choose a book.`}
          />
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {(subject.books || []).map((bk) => {
              const r = rollupBook(bk);
              return (
                <button
                  key={bk.id}
                  type="button"
                  onClick={() =>
                    setStep(["chapters", board.id, subject.id, bk.id])
                  }
                  className="text-left group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-amber-200 hover:shadow-md transition-all flex flex-col min-h-[160px]"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                      <BookOpenIcon className="h-5 w-5" />
                    </div>
                    <p className="font-semibold text-gray-900 leading-snug group-hover:text-indigo-900 flex-1">
                      {bk.title}
                    </p>
                    <ChevronRightIcon className="h-5 w-5 text-gray-300 group-hover:text-amber-600 shrink-0" />
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 border py-2">
                      <p className="text-lg font-bold tabular-nums">{r.chapters}</p>
                      <p className="text-[10px] font-semibold uppercase text-gray-500">Chapters</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border py-2">
                      <p className="text-lg font-bold tabular-nums">{r.topics}</p>
                      <p className="text-[10px] font-semibold uppercase text-gray-500">Topics</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step[0] === "chapters" && board && subject && book && (
        <>
          <CourseContextHeader
            enrollment={fauxEnrollment}
            boardName={board.name}
            subtitle={`${subject.name} · ${book.title}`}
          />
          <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 mb-6">
            <p className="text-xs font-semibold uppercase text-violet-700 tracking-wide mb-1">Book</p>
            <p className="text-xl font-bold text-gray-900">{book.title}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(book.chapters || []).map((ch) => {
              const n = ch.topics?.length || 0;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() =>
                    setStep(["topics", board.id, subject.id, book.id, ch.id])
                  }
                  className="text-left flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-violet-200 transition-all group"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                    <Square3Stack3DIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-violet-600 uppercase">
                      Chapter {ch.chapter_number ?? "—"}
                    </p>
                    <p className="font-semibold text-gray-900 mt-0.5 line-clamp-2">{ch.title}</p>
                    <p className="text-xs text-gray-500 mt-2">{n} topic{n !== 1 ? "s" : ""}</p>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-gray-300 group-hover:text-violet-500 shrink-0" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {step[0] === "topics" && board && subject && book && chapter && (
        <>
          <CourseContextHeader
            enrollment={fauxEnrollment}
            boardName={board.name}
            subtitle={`${subject.name} · ${book.title} · topics in this chapter`}
          />
          <div className="rounded-2xl border border-teal-100 bg-teal-50/35 p-4 mb-6">
            <p className="text-xs font-bold uppercase text-teal-800 tracking-wide mb-1">Chapter</p>
            <p className="text-lg font-bold text-gray-900">
              Ch. {chapter.chapter_number ?? "—"} — {chapter.title}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {(chapter.topics || []).map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col gap-4"
              >
                <div>
                  <h4 className="font-semibold text-gray-900">{t.title}</h4>
                </div>
                <div className="mt-auto flex flex-col sm:flex-row flex-wrap gap-2">
                  {t.has_slides ? (
                    <Link
                      to={`/admin/library/topics/${t.id}/present`}
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
                      title="No slides uploaded for this topic"
                      className="inline-flex flex-1 min-w-[10rem] cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-400"
                    >
                      <PresentationChartBarIcon className="h-4 w-4 shrink-0 opacity-60" />
                      View slides
                    </button>
                  )}
                  {t.has_lecture ? (
                    <Link
                      to={`/admin/topics/${t.id}/lecture`}
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
                      title="Teacher has not recorded a lecture yet"
                      className="inline-flex flex-1 min-w-[10rem] cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-400"
                    >
                      <PlayCircleIcon className="h-4 w-4 shrink-0 opacity-60" />
                      View recorded lecture
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Students use Study topic in the learner app for the full player + progress.
                </p>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
