import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowPathIcon,
  BookOpenIcon,
  FilmIcon,
  MagnifyingGlassIcon,
  PlayCircleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import libraryService from "../../services/libraryService";
import teacherService from "../../services/teacherService";
import RecordedLectureDurationCell, {
  coerceLectureMeta,
} from "../../components/library/RecordedLectureDuration";
import { PageSpinner } from "../../components/common/Spinner";

/** Single-line display for catalog strings (middle dot / bullet separated lists). */
function catalogInline(text, maxLen = 140) {
  if (text == null || String(text).trim() === "") return "—";
  const raw = String(text).trim();
  const parts = raw.split(/\s*[·•]\s*/).map((x) => x.trim()).filter(Boolean);
  const joined = parts.length ? parts.join(", ") : raw;
  return joined.length > maxLen ? `${joined.slice(0, Math.max(0, maxLen - 1))}…` : joined;
}

/**
 * Section rows often use `classes.name` like "1 - A" (grade – section). Show grade in **Class**
 * when curriculum library class is empty; show only **A, B** in **Sec**.
 */
function splitGradeFromSchoolSections(sectionsCatalog, libraryClassName) {
  const lib = (libraryClassName && String(libraryClassName).trim()) || "";
  const raw = sectionsCatalog && String(sectionsCatalog).trim();
  if (!raw) {
    return {
      classDisplay: lib || "—",
      secDisplay: "—",
      classTitle: lib || undefined,
      secTitle: undefined,
    };
  }

  const tokens = raw.split(/\s*[·•]\s*/).map((t) => t.trim()).filter(Boolean);
  const grades = new Set();
  const secLetters = new Set();
  const leftovers = [];

  const re = /^(\d+)\s*[-–—]\s*([A-Za-z0-9]+)\s*$/;
  for (const tok of tokens) {
    const m = tok.match(re);
    if (m) {
      grades.add(m[1]);
      secLetters.add(m[2]);
    } else {
      leftovers.push(tok);
    }
  }

  const gradeStr =
    grades.size > 0
      ? Array.from(grades)
          .sort((a, b) => Number(a) - Number(b))
          .join(", ")
      : "";

  let secDisplay;
  if (secLetters.size > 0) {
    secDisplay = Array.from(secLetters).sort().join(", ");
  } else if (leftovers.length > 0) {
    secDisplay = leftovers.join(", ");
  } else {
    secDisplay = "—";
  }

  const classDisplay = lib || gradeStr || "—";
  const classTitle = lib ? (gradeStr ? `${lib} · school grades ${gradeStr}` : lib) : gradeStr || undefined;

  return {
    classDisplay,
    secDisplay,
    classTitle,
    secTitle: raw,
  };
}

function Cell({ children, title, className = "" }) {
  return (
    <td className={`py-2.5 px-3 align-top text-gray-800 ${className}`} title={title}>
      <div className="text-xs leading-snug break-words max-w-[11rem] xl:max-w-[13rem]">{children}</div>
    </td>
  );
}

function formatSavedAt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminRecordedLectures() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const next = query.trim();
    const delay = next.length === 0 ? 0 : 320;
    const t = setTimeout(() => {
      setDebouncedQ(next);
      setOffset(0);
    }, delay);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await teacherService.listMyLectures({
        q: debouncedQ || undefined,
        limit,
        offset,
      });
      const payload = res?.data?.data ?? res?.data;
      const rawItems = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : [];
      setItems(rawItems);
      setTotal(Number(payload?.total) || 0);
    } catch (e) {
      console.error(e);
      toast.error("Could not load recorded lectures.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, offset, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const showPager = total > limit;

  const openStudio = (topicId) => {
    const url = `/admin/record-lecture/${encodeURIComponent(topicId)}`;
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) toast.error("Allow pop-ups to open the recorder in a new tab.");
  };

  const openPlayer = (topicId) => {
    const url = `/admin/topics/${encodeURIComponent(topicId)}/lecture`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (topicId, title) => {
    if (!window.confirm(`Delete recorded lecture for "${title}"? Slides stay; only the video is removed.`)) {
      return;
    }
    try {
      await teacherService.deleteMyTopicLecture(topicId);
      toast.success("Lecture deleted.");
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error("Could not delete lecture.");
    }
  };

  return (
    <div className="p-6 max-w-[90rem] mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FilmIcon className="h-8 w-8 text-rose-500" />
            Recorded lectures
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Every topic lecture appears here after you finish recording and tap <strong>Save Lecture</strong> on the preview
            (the page only lists videos stored on the server). Search matches curriculum fields and, when a book is assigned to school
            sections, school / branch / section names too.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/library"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <BookOpenIcon className="h-4 w-4" />
            Curriculum library
          </Link>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search e.g. Class 1, Computer Science, school name, branch, section, board, book…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm shadow-sm focus:ring-2 focus:ring-rose-500/25 focus:border-rose-400 outline-none"
        />
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1200px]">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-700 uppercase tracking-wide bg-gray-50 whitespace-nowrap">
                    <th className="text-left py-2.5 px-3 font-semibold">School</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Branch</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Class</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Sec</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Subject</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Chapter</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Topic</th>
                    <th className="text-left py-2.5 px-3 font-semibold">Saved</th>
                    <th className="text-center py-2.5 px-3 font-semibold">Duration</th>
                    <th className="text-center py-2.5 px-3 font-semibold">Quality</th>
                    <th className="text-right py-2.5 px-3 font-semibold sticky right-0 bg-gray-50/90 z-[1] shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((row) => {
                    const meta = coerceLectureMeta(row.lecture_metadata_json ?? row.lecture_metadata);
                    const libClass = row.library_class_name || row.class_name;
                    const split = splitGradeFromSchoolSections(row.sections_catalog, libClass);
                    const chapterLabel =
                      row.chapter_number != null
                        ? `Ch ${row.chapter_number}${row.chapter_title ? `: ${row.chapter_title}` : ""}`
                        : row.chapter_title || "—";
                    const schoolTxt = catalogInline(row.schools_catalog);
                    const branchTxt = catalogInline(row.branches_catalog);
                    const topicTitle = row.topic_title || "—";
                    const topicTip = `${topicTitle}\n${row.topic_id || ""}`;
                    return (
                      <tr key={row.topic_id} className="group hover:bg-gray-50/90 align-top">
                        <Cell title={row.schools_catalog || undefined}>{schoolTxt}</Cell>
                        <Cell title={row.branches_catalog || undefined}>{branchTxt}</Cell>
                        <Cell title={split.classTitle || "Curriculum library class, or grade from school sections"}>
                          {split.classDisplay}
                        </Cell>
                        <Cell title={split.secTitle || undefined}>{split.secDisplay}</Cell>
                        <Cell>{row.subject_name || "—"}</Cell>
                        <Cell title={chapterLabel}>{chapterLabel}</Cell>
                        <Cell title={topicTip}>
                          <span className="font-semibold text-gray-900">{topicTitle}</span>
                          {row.book_title ? (
                            <span className="block text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={row.book_title}>
                              {row.book_title}
                            </span>
                          ) : null}
                          {row.book_id ? (
                            <Link
                              to={`/admin/library/books/${row.book_id}`}
                              className="block mt-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              Open book
                            </Link>
                          ) : null}
                          <span className="block text-[10px] text-gray-400 font-mono truncate mt-0.5" title={row.topic_id}>
                            {row.topic_id}
                          </span>
                        </Cell>
                        <td className="py-2.5 px-3 align-top text-gray-600 whitespace-nowrap text-xs">
                          {formatSavedAt(row.lecture_saved_at)}
                        </td>
                        <td className="py-2.5 px-3 align-middle text-center text-gray-900 tabular-nums text-xs min-w-[4rem]">
                          <RecordedLectureDurationCell
                            lectureVideoUrl={row.lecture_video_url}
                            lectureMetadata={meta}
                            lectureDurationSeconds={row.lecture_duration_seconds}
                          />
                        </td>
                        <td className="py-2.5 px-3 align-middle text-center text-gray-900 text-xs font-medium min-w-[3rem]">
                          {typeof meta?.quality === "string" ? meta.quality : "—"}
                        </td>
                        <td className="py-2.5 px-3 align-top text-right sticky right-0 z-[1] bg-white shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.12)] group-hover:bg-gray-50/90">
                          <div className="inline-flex flex-row flex-wrap justify-end gap-1 max-w-[14rem]">
                            <button
                              type="button"
                              onClick={() => openPlayer(row.topic_id)}
                              className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-100"
                            >
                              <PlayCircleIcon className="h-3.5 w-3.5 shrink-0" />
                              Watch
                            </button>
                            <button
                              type="button"
                              onClick={() => openStudio(row.topic_id)}
                              className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-rose-50 text-rose-800 text-[11px] font-semibold hover:bg-rose-100"
                            >
                              <FilmIcon className="h-3.5 w-3.5 shrink-0" />
                              Re-record
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.topic_id, row.topic_title)}
                              className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-[11px] font-semibold hover:bg-red-50 hover:text-red-700"
                            >
                              <TrashIcon className="h-3.5 w-3.5 shrink-0" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-gray-500">
                        <FilmIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium text-gray-700">No recorded lectures yet</p>
                        <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                          Save slides on a topic, then use <strong>Record lecture</strong> from the library or book view. When the
                          studio stops, choose <strong>Save Lecture</strong> so it is uploaded—only then will it appear in this list.
                        </p>
                        <Link
                          to="/admin/library"
                          className="inline-block mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          Go to Curriculum Library
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showPager && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-gray-600">
              <p>
                {total === 0 ? (
                  <>Showing 0 of 0</>
                ) : (
                  <>
                    Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={offset <= 0}
                  onClick={() => setOffset((o) => Math.max(0, o - limit))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 font-semibold"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-400">
                  Page {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset((o) => o + limit)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
