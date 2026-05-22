import { useState, useEffect } from "react";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import lessonService from "../../services/lessonService";
import teacherService from "../../services/teacherService";
import { TopicSelector } from "./TopicSelector";

export function LessonPlanModal({
  open,
  onClose,
  onLessonCreated,
  user = null,
  assignedClasses = [],
  assignedBooks = [],
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    bookId: "",
    subjectId: "",
    topics: [],
    date: "",
    classIds: [],
    title: "",
    description: "",
    duration: 45,
  });

  // Available options
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [booksWithTopics, setBooksWithTopics] = useState([]);

  // Get available subjects for selected book
  useEffect(() => {
    if (!open) return;
    if (formData.bookId) {
      const book = assignedBooks.find((b) => b.id === formData.bookId);
      if (book) {
        const uniqueSubjects = Array.from(
          new Map(
            assignedBooks
              .filter((b) => b.id === formData.bookId)
              .map((b) => [b.library_subject_id, { id: b.library_subject_id, name: b.subject_name }])
          ).values()
        );
        setAvailableSubjects(uniqueSubjects);
        if (uniqueSubjects.length > 0 && !formData.subjectId) {
          setFormData((prev) => ({ ...prev, subjectId: uniqueSubjects[0].id }));
        }
      }
    }
  }, [formData.bookId, assignedBooks]);

  // Load book chapters/topics when book selected
  useEffect(() => {
    if (formData.bookId) {
      loadBookDetails();
    }
  }, [formData.bookId]);

  const loadBookDetails = async () => {
    setLoadingTopics(true);
    try {
      const response = await teacherService.getTeacherBook(formData.bookId);
      const bookData = response.data?.data;
      if (bookData) {
        // Prepare chapters with topics
        const chapters = [
          ...(bookData.approved_chapters || []),
          ...(bookData.custom_chapters || []),
        ].map((ch) => ({
          id: ch.id,
          chapter_number: ch.chapter_number,
          title: ch.title,
          topics: [
            ...(ch.approved_topics || []),
            ...(ch.custom_topics || []),
          ].map((t) => ({
            id: t.id,
            title: t.title,
            chapter_number: ch.chapter_number,
          })),
        }));
        setBooksWithTopics(chapters);
      }
    } catch (error) {
      toast.error("Failed to load book details");
      console.error("Error loading book:", error);
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleNext = () => {
    // Validate current step
    if (step === 1 && !formData.bookId) {
      toast.error("Please select a book");
      return;
    }
    if (step === 2 && formData.topics.length === 0) {
      toast.error("Please select at least one topic");
      return;
    }
    if (step === 3 && !formData.date) {
      toast.error("Please select a date");
      return;
    }
    if (step === 4 && formData.classIds.length === 0) {
      toast.error("Please select at least one class");
      return;
    }
    if (step < 5) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCreate = async () => {
    if (!formData.date || formData.classIds.length === 0 || formData.topics.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        planned_date: formData.date,
        class_ids: formData.classIds,
        library_book_id: formData.bookId,
        library_subject_id: formData.subjectId,
        topics: formData.topics,
        title: formData.title || null,
        description: formData.description || null,
        duration_minutes: parseInt(formData.duration, 10),
      };

      const response = await lessonService.createLessonPlan(payload);
      const newLesson = response.data;

      toast.success("Lesson plan created successfully");
      onLessonCreated?.(newLesson);
      onClose();

      // Reset form
      setStep(1);
      setFormData({
        bookId: "",
        subjectId: "",
        topics: [],
        date: "",
        classIds: [],
        title: "",
        description: "",
        duration: 45,
      });
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "Failed to create lesson");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // Get assigned books for dropdown
  const uniqueBooks = assignedBooks.reduce((acc, book) => {
    if (!acc.find((b) => b.id === book.id)) {
      acc.push(book);
    }
    return acc;
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">Create Lesson Plan</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 px-6 py-4 border-b border-gray-100">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex-1">
              <div
                className={`h-1 rounded-full ${
                  s <= step ? "bg-indigo-600" : "bg-gray-200"
                }`}
              />
              <p className="text-xs mt-1 text-gray-600 text-center">
                {s === 1
                  ? "Book"
                  : s === 2
                  ? "Topics"
                  : s === 3
                  ? "Date"
                  : s === 4
                  ? "Classes"
                  : "Review"}
              </p>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 min-h-64">
          {/* Step 1: Select Book */}
          {step === 1 && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Assigned Book
                </span>
                <select
                  value={formData.bookId}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      bookId: e.target.value,
                      topics: [],
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                >
                  <option value="">Select a book you are assigned to...</option>
                  {uniqueBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.book_title} ({b.subject_name})
                    </option>
                  ))}
                </select>
              </label>
              {uniqueBooks.length === 0 && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
                  No books assigned to you. Please contact your administrator.
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Topics */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-900">
                Select topics from <strong>{uniqueBooks.find(b => b.id === formData.bookId)?.book_title}</strong>
              </p>
              <TopicSelector
                bookId={formData.bookId}
                assignedBooks={booksWithTopics}
                selectedTopics={formData.topics}
                onTopicsChange={(topics) => {
                  setFormData((prev) => ({ ...prev, topics }));
                }}
                loading={loadingTopics}
              />
            </div>
          )}

          {/* Step 3: Select Date */}
          {step === 3 && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Lesson Date
                </span>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, date: e.target.value }));
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                />
              </label>
              {formData.date && new Date(formData.date) < new Date() && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
                  ⚠️ This date is in the past. You can still create the lesson, but it won't appear in future planning.
                </div>
              )}
            </div>
          )}

          {/* Step 4: Select Classes */}
          {step === 4 && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Classes (Select at least one)
                </span>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {assignedClasses.length === 0 ? (
                    <p className="text-sm text-gray-500">No classes assigned</p>
                  ) : (
                    assignedClasses.map((cls) => (
                      <label key={cls.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.classIds.includes(cls.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData((prev) => ({
                                ...prev,
                                classIds: [...prev.classIds, cls.id],
                              }));
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                classIds: prev.classIds.filter((id) => id !== cls.id),
                              }));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{cls.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </label>
            </div>
          )}

          {/* Step 5: Review & Additional Info */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <p>
                  <span className="font-semibold text-gray-900">Book:</span>{" "}
                  <span className="text-gray-700">
                    {uniqueBooks.find((b) => b.id === formData.bookId)?.book_title}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Topics:</span>{" "}
                  <span className="text-gray-700">{formData.topics.length} selected</span>
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Date:</span>{" "}
                  <span className="text-gray-700">
                    {new Date(formData.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Classes:</span>{" "}
                  <span className="text-gray-700">
                    {assignedClasses
                      .filter((c) => formData.classIds.includes(c.id))
                      .map((c) => c.name)
                      .join(", ")}
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Lesson Title (Optional)
                  </span>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, title: e.target.value }));
                    }}
                    placeholder="e.g., Introduction to Photosynthesis"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Duration (minutes)
                  </span>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    value={formData.duration}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, duration: e.target.value }));
                    }}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Description (Optional)
                  </span>
                  <textarea
                    value={formData.description}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, description: e.target.value }));
                    }}
                    placeholder="e.g., Use slides from chapter 5..."
                    rows="3"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between gap-2">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={step === 1}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"
              >
                Next
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Lesson"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
