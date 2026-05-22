import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useLessonPlanning } from "../../hooks/useLessonPlanning";
import { LessonPlanModal } from "../../components/teacher/LessonPlanModal";
import { LessonCalendar } from "../../components/teacher/LessonCalendar";
import { LessonList } from "../../components/teacher/LessonList";
import { SyllabusCoverageCard } from "../../components/teacher/SyllabusCoverageCard";
import teacherService from "../../services/teacherService";
import toast from "react-hot-toast";

export function LessonPlanning() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("calendar");
  const [showModal, setShowModal] = useState(false);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [assignedBooks, setAssignedBooks] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    lessonPlans,
    currentMonth,
    setCurrentMonth,
    fetchLessons,
    createLesson,
    updateLesson,
    deleteLesson,
    markComplete,
    getSyllabusCoverage,
  } = useLessonPlanning(user?.id);

  // Load teacher's assigned classes and books
  useEffect(() => {
    if (user?.id) {
      loadTeacherData();
    }
  }, [user?.id]);

  // Load lessons when date range changes
  useEffect(() => {
    if (user?.id) {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];
      fetchLessons(monthStart, monthEnd);
    }
  }, [user?.id, currentMonth]);

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      // Get teacher curriculum with assigned classes and books
      const curriculumResponse = await teacherService.getMyCurriculum();
      const curriculum = Array.isArray(curriculumResponse.data) ? curriculumResponse.data : [];

      if (curriculum.length > 0) {
        // Get unique classes
        const classMap = new Map();
        const booksArray = [];

        curriculum.forEach((classItem) => {
          classMap.set(classItem.class_id, {
            id: classItem.class_id,
            name: classItem.class_name || `Class ${classItem.grade_level}`,
          });

          // Extract books and subjects
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

        // Pre-select first class and subject
        if (classes.length > 0) {
          setSelectedClassId(classes[0].id);
        }
        if (booksArray.length > 0) {
          setSelectedSubjectId(booksArray[0].library_subject_id);
        }
      }
    } catch (error) {
      toast.error("Failed to load teacher data");
      console.error("Error loading teacher data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLessonCreated = () => {
    setShowModal(false);
    loadTeacherData();
    // Refresh lessons
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
    fetchLessons(monthStart, monthEnd);
  };

  const handleDeleteLesson = async (lessonId) => {
    try {
      await deleteLesson(lessonId);
      // Refresh
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];
      fetchLessons(monthStart, monthEnd);
    } catch (error) {
      console.error("Error deleting lesson:", error);
    }
  };

  const handleMarkComplete = async (lessonId) => {
    try {
      await markComplete(lessonId);
      // Refresh
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];
      fetchLessons(monthStart, monthEnd);
    } catch (error) {
      console.error("Error marking lesson complete:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Lesson Planning</h1>
          <p className="text-gray-600 mt-1">
            Plan and schedule lessons to systematically cover your syllabus
          </p>
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

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            <option value="">Select a class...</option>
            {assignedClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          >
            <option value="">Select a subject...</option>
            {Array.from(
              new Map(
                assignedBooks.map((b) => [
                  b.library_subject_id,
                  { id: b.library_subject_id, name: b.subject_name },
                ])
              ).values()
            ).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-6">
            {[
              { id: "calendar", label: "Calendar" },
              { id: "list", label: "List View" },
              { id: "coverage", label: "Coverage" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 font-medium text-sm transition border-b-2 ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading lesson planning data...
            </div>
          ) : (
            <>
              {/* Calendar Tab */}
              {activeTab === "calendar" && (
                <LessonCalendar
                  teacherId={user?.id}
                  onDateSelect={(date) => {
                    // Filter lessons for selected date
                  }}
                  onDayClick={(date) => {
                    // Show lessons for that day
                  }}
                />
              )}

              {/* List Tab */}
              {activeTab === "list" && (
                <LessonList
                  lessons={lessonPlans}
                  onEdit={() => {
                    // Edit lesson
                  }}
                  onDelete={handleDeleteLesson}
                  onMarkComplete={handleMarkComplete}
                  loading={false}
                />
              )}

              {/* Coverage Tab */}
              {activeTab === "coverage" && (
                <SyllabusCoverageCard
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

      {/* Modal */}
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
