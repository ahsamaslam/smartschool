import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useLessonPlanning } from "../../hooks/useLessonPlanning";
import { LessonPlanModal } from "../../components/teacher/LessonPlanModal";
import { LessonEditModal } from "../../components/teacher/LessonEditModal";
import { LessonCalendar } from "../../components/teacher/LessonCalendar";
import { SyllabusCoverageCard } from "../../components/teacher/SyllabusCoverageCard";
import { CheckCircleIcon, PencilSquareIcon, TrashIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import teacherService from "../../services/teacherService";
import lessonService from "../../services/lessonService";
import toast from "react-hot-toast";

function DeleteConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Delete Lesson</h3>
            <p className="text-sm text-gray-500 mt-1">Are you sure you want to delete this lesson? This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  completed:   { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-900",  badge: "bg-green-100 text-green-800",  label: "Completed" },
  in_progress: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-900", badge: "bg-yellow-100 text-yellow-800", label: "In Progress" },
  postponed:   { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-900",    badge: "bg-red-100 text-red-800",    label: "Postponed" },
  planned:     { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-900",   badge: "bg-blue-100 text-blue-800",  label: "Planned" },
};

function DayLessonsPanel({ date, teacherId, onEdit, onDelete, onMarkComplete }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedTopics, setExpandedTopics] = useState(new Set());

  const toggleTopics = (lessonId) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      next.has(lessonId) ? next.delete(lessonId) : next.add(lessonId);
      return next;
    });
  };

  useEffect(() => {
    if (date && teacherId) loadDayLessons();
  }, [date, teacherId]);

  const loadDayLessons = async () => {
    setLoading(true);
    try {
      const res = await lessonService.getLessonPlans(teacherId, date, date);
      setLessons(res.data?.lessons || []);
    } catch {
      toast.error("Failed to load lessons for this date");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (lessonId) => {
    try {
      await lessonService.markLessonComplete(lessonId);
      toast.success("Lesson marked as completed");
      loadDayLessons();
      onMarkComplete?.();
    } catch {
      toast.error("Failed to mark lesson complete");
    }
  };

  const handleDelete = async (lessonId) => {
    try {
      await lessonService.deleteLessonPlan(lessonId);
      toast.success("Lesson deleted");
      loadDayLessons();
      onDelete?.();
    } catch {
      toast.error("Failed to delete lesson");
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

  const formatTime = (t) => (t ? t.slice(0, 5) : "");

  if (!date) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-gray-900">{formatDate(date)}</h3>
        {!loading && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500 text-sm">Loading...</div>
      ) : lessons.length === 0 ? (
        <div className="py-10 text-center bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-gray-500 font-medium">No lessons planned for this day</p>
          <p className="text-xs text-gray-400 mt-1">Click "+ Create Lesson" to add one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const cfg = STATUS_CONFIG[lesson.status] || STATUS_CONFIG.planned;
            return (
              <div key={lesson.id} className={`border rounded-xl p-4 space-y-3 ${cfg.bg} ${cfg.border}`}>
                {/* Row 1: Time, Status, Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`font-bold text-sm ${cfg.text}`}>
                      {formatTime(lesson.planned_time)}{lesson.end_time ? ` – ${formatTime(lesson.end_time)}` : ""}
                    </p>
                    <p className={`text-xs opacity-70 ${cfg.text}`}>{lesson.duration_minutes} min</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <div className="flex gap-1">
                      {lesson.status !== "completed" && (
                        <button type="button" title="Mark complete"
                          onClick={() => handleMarkComplete(lesson.id)}
                          className={`p-1.5 rounded-lg hover:bg-white/40 ${cfg.text}`}>
                          <CheckCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" title="Edit lesson"
                        onClick={() => onEdit?.(lesson)}
                        className={`p-1.5 rounded-lg hover:bg-white/40 ${cfg.text}`}>
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button type="button" title="Delete lesson"
                        onClick={() => setDeletingId(lesson.id)}
                        className={`p-1.5 rounded-lg hover:bg-white/40 ${cfg.text}`}>
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Title & Subject */}
                <div>
                  {lesson.title && <p className={`font-semibold text-sm ${cfg.text}`}>{lesson.title}</p>}
                  <p className={`text-xs opacity-70 ${cfg.text}`}>{lesson.subject_name}</p>
                </div>

                {/* Row 3: Classes */}
                <div className="flex flex-wrap gap-1">
                  {lesson.class_names?.length > 0 ? (
                    lesson.class_names.map((name) => (
                      <span key={name} className="px-2 py-0.5 rounded text-xs font-medium bg-white/50">{name}</span>
                    ))
                  ) : (
                    <span className={`text-xs opacity-60 ${cfg.text}`}>No classes</span>
                  )}
                </div>

                {/* Row 4: Topics */}
                {lesson.topics?.length > 0 && (
                  <div className={`border-t border-current/10 pt-2`}>
                    <button
                      type="button"
                      onClick={() => toggleTopics(lesson.id)}
                      className={`flex items-center gap-1 text-xs font-semibold opacity-80 hover:opacity-100 mb-2 ${cfg.text}`}
                    >
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/50 text-xs font-bold`}>
                        {expandedTopics.has(lesson.id) ? "−" : "+"}
                      </span>
                      Topics ({lesson.topics.length})
                      {!expandedTopics.has(lesson.id) && lesson.topics.length > 3 && (
                        <span className="opacity-60 font-normal"> — click to see all</span>
                      )}
                    </button>
                    <div className="space-y-1">
                      {(expandedTopics.has(lesson.id) ? lesson.topics : lesson.topics.slice(0, 3)).map((t, i) => (
                        <div key={t.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-white/40">
                          <span className={`flex-shrink-0 w-5 h-5 rounded-full bg-white/60 text-xs font-bold flex items-center justify-center ${cfg.text}`}>
                            {i + 1}
                          </span>
                          <span className={`text-xs ${cfg.text}`}>
                            {t.chapter_number ? <span className="font-semibold">Ch{t.chapter_number}: </span> : null}
                            {t.title}
                          </span>
                        </div>
                      ))}
                      {!expandedTopics.has(lesson.id) && lesson.topics.length > 3 && (
                        <button
                          type="button"
                          onClick={() => toggleTopics(lesson.id)}
                          className={`w-full text-center text-xs py-1 rounded-lg bg-white/30 hover:bg-white/50 font-medium ${cfg.text} opacity-70`}
                        >
                          + {lesson.topics.length - 3} more topics
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {lesson.description && (
                  <div className={`pt-2 border-t border-current/10 text-xs opacity-70 ${cfg.text}`}>
                    {lesson.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deletingId && (
        <DeleteConfirmModal
          onConfirm={() => { handleDelete(deletingId); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

export default function LessonPlanning() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("calendar");
  const [showModal, setShowModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [assignedBooks, setAssignedBooks] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [coverageRefreshKey, setCoverageRefreshKey] = useState(0);
  const [dayPanelKey, setDayPanelKey] = useState(0);

  const { currentMonth, setCurrentMonth } = useLessonPlanning(user?.id);

  useEffect(() => {
    if (user?.id) loadTeacherData();
  }, [user?.id]);

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      const curriculumResponse = await teacherService.getMyCurriculum();
      const curriculum = Array.isArray(curriculumResponse.data) ? curriculumResponse.data : [];

      if (curriculum.length > 0) {
        const classMap = new Map();
        const booksArray = [];

        curriculum.forEach((classItem) => {
          classMap.set(classItem.class_id, {
            id: classItem.class_id,
            name: classItem.class_name || `Class ${classItem.grade_level}`,
          });
          if (classItem.subjects) {
            classItem.subjects.forEach((subject) => {
              if (subject.books) {
                subject.books.forEach((book) => {
                  booksArray.push({
                    id: book.book_id,
                    library_subject_id: subject.subject_id,
                    book_title: book.book_title,
                    subject_name: subject.subject_name,
                  });
                });
              }
            });
          }
        });

        const classes = Array.from(classMap.values());
        setAssignedClasses(classes);
        setAssignedBooks(booksArray);
        if (classes.length > 0) setSelectedClassId(classes[0].id);
        if (booksArray.length > 0) setSelectedSubjectId(booksArray[0].library_subject_id);
      }
    } catch {
      toast.error("Failed to load teacher data");
    } finally {
      setLoading(false);
    }
  };

  const handleDayClick = (dateStr) => {
    setSelectedDate(dateStr);
  };

  const handleLessonCreated = () => {
    setShowModal(false);
    setDayPanelKey((k) => k + 1);
    setCoverageRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Lesson Planning</h1>
          <p className="text-gray-600 mt-1">Plan and schedule lessons to systematically cover your syllabus</p>
        </div>

        {/* Action Bar */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
          >
            + Create Lesson
          </button>
        </div>

        {/* Coverage Filters — only shown on coverage tab */}
        {activeTab === "coverage" && (
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm">
              <option value="">Select a class...</option>
              {assignedClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm">
              <option value="">Select a subject...</option>
              {Array.from(
                new Map(assignedBooks.map((b) => [b.library_subject_id, { id: b.library_subject_id, name: b.subject_name }])).values()
              ).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-6">
            {[
              { id: "calendar", label: "Calendar" },
              { id: "coverage", label: "Coverage" },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 font-medium text-sm transition border-b-2 ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className={activeTab === "calendar" ? "" : "bg-white rounded-xl border border-gray-200 p-4 sm:p-6"}>
          {loading ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
              Loading lesson planning data...
            </div>
          ) : (
            <>
              {activeTab === "calendar" && (
                <div>
                  <LessonCalendar
                    teacherId={user?.id}
                    selectedDate={selectedDate}
                    onDayClick={handleDayClick}
                  />
                  {selectedDate && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                      <DayLessonsPanel
                        key={`${selectedDate}-${dayPanelKey}`}
                        date={selectedDate}
                        teacherId={user?.id}
                        onEdit={(lesson) => setEditingLesson(lesson)}
                        onDelete={() => setCoverageRefreshKey((k) => k + 1)}
                        onMarkComplete={() => setCoverageRefreshKey((k) => k + 1)}
                      />
                    </div>
                  )}
                  {!selectedDate && (
                    <div className="mt-6 py-10 text-center bg-white rounded-xl border border-gray-200 border-dashed">
                      <p className="text-gray-400 text-sm">Click any date on the calendar to view its lessons</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "coverage" && (
                <SyllabusCoverageCard
                  key={coverageRefreshKey}
                  teacherId={user?.id}
                  classId={selectedClassId}
                  librarySubjectId={selectedSubjectId}
                  loading={false}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <LessonEditModal
        lesson={editingLesson}
        onClose={() => setEditingLesson(null)}
        onUpdated={() => {
          setEditingLesson(null);
          setDayPanelKey((k) => k + 1);
          setCoverageRefreshKey((k) => k + 1);
        }}
        assignedClasses={assignedClasses}
        assignedBooks={assignedBooks}
      />

      {/* Create Modal */}
      <LessonPlanModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onLessonCreated={handleLessonCreated}
        user={user}
        assignedClasses={assignedClasses}
        assignedBooks={assignedBooks}
      />
    </div>
  );
}
