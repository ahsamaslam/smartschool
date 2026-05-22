import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import teacherService from "../../services/teacherService";
import toast from "react-hot-toast";
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

// ── Book Card ─────────────────────────────────────────────────────────────────
function BookCard({ book, onOpenBook }) {
  return (
    <button
      type="button"
      onClick={onOpenBook}
      className="text-left w-full p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100">
          <BookOpenIcon className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 truncate">{book.book_title}</p>
          {book.book_author && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{book.book_author}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {book.chapter_count ?? 0} ch · {book.topic_count ?? 0} topics
          </p>
        </div>
      </div>
      <p className="text-xs text-indigo-600 font-medium mt-3 group-hover:text-indigo-700">
        Open Book →
      </p>
    </button>
  );
}

// ── Subject Section ───────────────────────────────────────────────────────────
function SubjectSection({ subject, onBookClick }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left py-2 px-1"
      >
        {open
          ? <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
          : <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
        }
        <span className="text-sm font-semibold text-gray-700">{subject.subject_name}</span>
        {subject.board_name && (
          <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
            {subject.board_name}
          </span>
        )}
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-6 mt-2">
          {subject.books.map((book) => (
            <BookCard
              key={book.book_id}
              book={book}
              onOpenBook={() => onBookClick(book.book_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Class Accordion ───────────────────────────────────────────────────────────
function ClassAccordion({ cls, onBookClick, forceOpen }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  const label = cls.section
    ? `Class ${cls.grade_level} — Section ${cls.section}`
    : cls.class_name || `Class ${cls.grade_level}`;

  const totalBooks = cls.subjects.reduce((s, sub) => s + sub.books.length, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-3 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        {isOpen
          ? <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
          : <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
        }
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <AcademicCapIcon className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {cls.subjects.length} subject{cls.subjects.length !== 1 ? "s" : ""} · {totalBooks} book{totalBooks !== 1 ? "s" : ""}
          </p>
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/30">
          {cls.subjects.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No books assigned for this class.</p>
          ) : (
            cls.subjects.map((sub) => (
              <SubjectSection
                key={sub.subject_id}
                subject={sub}
                onBookClick={onBookClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherMyCurriculum() {
  const navigate = useNavigate();
  const [curriculum, setCurriculum] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await teacherService.getMyCurriculum();
      setCurriculum(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("Failed to load your curriculum.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBookClick = (bookId) => {
    navigate(`/admin/library/books/${bookId}`);
  };

  const q = search.toLowerCase().trim();
  const filtered = q
    ? curriculum.filter((cls) =>
        cls.class_name?.toLowerCase().includes(q) ||
        cls.grade_level?.toLowerCase().includes(q) ||
        cls.subjects.some(
          (sub) =>
            sub.subject_name?.toLowerCase().includes(q) ||
            sub.books.some((b) => b.book_title?.toLowerCase().includes(q))
        )
      )
    : curriculum;

  const totalBooks = curriculum.reduce(
    (sum, cls) => sum + cls.subjects.reduce((s, sub) => s + sub.books.length, 0),
    0
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Curriculum</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Books and topics assigned to you across your classes
        </p>
      </div>

      {/* Stats */}
      {!loading && curriculum.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Classes", value: curriculum.length, color: "bg-amber-50 text-amber-700" },
            {
              label: "Subjects",
              value: curriculum.reduce((s, cls) => s + cls.subjects.length, 0),
              color: "bg-indigo-50 text-indigo-700",
            },
            { label: "Books", value: totalBooks, color: "bg-blue-50 text-blue-700" },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.color} rounded-2xl p-4`}>
              <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
              <p className="text-xs font-medium mt-0.5 opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search classes, subjects, books…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BookOpenIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {curriculum.length === 0
              ? "No books have been assigned to you yet. Ask your admin or manager."
              : "No results match your search."}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map((cls) => (
            <ClassAccordion
              key={cls.class_id}
              cls={cls}
              onBookClick={handleBookClick}
              forceOpen={q.length > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
