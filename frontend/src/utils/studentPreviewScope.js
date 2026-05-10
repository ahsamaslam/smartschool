/** Shared helpers for admin student preview + Students modal (exam-scope API). */

export function formatHistoryClass(h) {
  return `Class ${h.grade_level || h.class_name || "—"}${h.section ? ` - ${h.section}` : ""}`;
}

/** Aligns with Add Student curriculum preview — counts + outline from exam-scope API. */
export function summarizeScope(body) {
  if (!body) {
    return {
      subjects: 0,
      books: 0,
      topics: 0,
      mode: "",
      boardsDetail: [],
    };
  }
  if (body.mode === "flat_legacy") {
    const subs = body.subjects || [];
    let topics = 0;
    const boardsDetail = subs.map((s) => {
      const tc = (s.topics || []).length;
      topics += tc;
      return { name: s.name, topicCount: tc };
    });
    return {
      subjects: subs.length,
      books: 0,
      topics,
      mode: "flat_legacy",
      boardsDetail,
    };
  }
  if (body.mode === "library_tree") {
    let subjects = 0;
    let books = 0;
    let topics = 0;
    const boardsDetail = [];
    for (const board of body.boards || []) {
      const subList = [];
      for (const sub of board.subjects || []) {
        subjects += 1;
        const bookRows = [];
        for (const bk of sub.books || []) {
          books += 1;
          let topicCount = 0;
          const chCount = (bk.chapters || []).length;
          for (const ch of bk.chapters || []) {
            topicCount += (ch.topics || []).length;
          }
          topics += topicCount;
          bookRows.push({
            title: bk.title || "Untitled book",
            topicCount,
            chapters: chCount,
          });
        }
        subList.push({ name: sub.name || "Subject", books: bookRows });
      }
      boardsDetail.push({
        name: board.name || "Board",
        subjects: subList,
      });
    }
    return {
      subjects,
      books,
      topics,
      mode: "library_tree",
      boardsDetail,
    };
  }
  return {
    subjects: 0,
    books: 0,
    topics: 0,
    mode: body.mode || "unknown",
    boardsDetail: [],
  };
}
