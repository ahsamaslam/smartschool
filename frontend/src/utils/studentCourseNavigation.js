/**
 * Helpers for student curriculum drill-down (enrollment tree from /learning/tree).
 */

const idEq = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();

export function findEnrollment(enrollments, classId) {
  return (enrollments || []).find((e) => idEq(e.class_id, classId)) || null;
}

export function findBoard(enrollment, boardId) {
  return (enrollment?.boards || []).find((b) => idEq(b.id, boardId)) || null;
}

export function findSubject(board, subjectId) {
  return (board?.subjects || []).find((s) => idEq(s.id, subjectId)) || null;
}

export function findBook(subject, bookId) {
  return (subject?.books || []).find((bk) => idEq(bk.id, bookId)) || null;
}

export function findChapter(book, chapterId) {
  return (book?.chapters || []).find((ch) => idEq(ch.id, chapterId)) || null;
}

/** @returns {{ books: number, chapters: number, topics: number }} */
export function rollupSubject(subject) {
  let chapters = 0;
  let topics = 0;
  const books = subject?.books?.length || 0;
  for (const b of subject?.books || []) {
    chapters += (b.chapters || []).length;
    for (const ch of b.chapters || []) {
      topics += (ch.topics || []).length;
    }
  }
  return { books, chapters, topics };
}

/** @returns {{ chapters: number, topics: number }} */
export function rollupBook(book) {
  let topics = 0;
  const chapters = book?.chapters?.length || 0;
  for (const ch of book?.chapters || []) {
    topics += (ch.topics || []).length;
  }
  return { chapters, topics };
}

const enc = (x) => encodeURIComponent(String(x));

export function pathToSubject(classId, boardId, subjectId) {
  return `/student/courses/class/${enc(classId)}/board/${enc(boardId)}/subject/${enc(subjectId)}`;
}

export function pathToBook(classId, boardId, subjectId, bookId) {
  return `${pathToSubject(classId, boardId, subjectId)}/book/${enc(bookId)}`;
}

export function pathToChapter(classId, boardId, subjectId, bookId, chapterId) {
  return `${pathToBook(classId, boardId, subjectId, bookId)}/chapter/${enc(chapterId)}`;
}
