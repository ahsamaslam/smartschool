import { useState, useEffect, useRef } from "react";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import lessonService from "../../services/lessonService";
import teacherService from "../../services/teacherService";
import { TopicSelector } from "./TopicSelector";

export function LessonEditModal({ lesson, onClose, onUpdated, assignedClasses = [], assignedBooks = [] }) {
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [booksWithTopics, setBooksWithTopics] = useState([]);

  const [formData, setFormData] = useState({
    bookId: "",
    subjectId: "",
    topics: [],
    date: "",
    startTime: "09:00",
    endTime: "10:00",
    classIds: [],
    title: "",
    description: "",
    status: "planned",
  });

  // Pre-fill form when lesson opens
  useEffect(() => {
    if (lesson) {
      setStep(1);
      setFormData({
        bookId: lesson.library_book_id || "",
        subjectId: lesson.library_subject_id || "",
        topics: (lesson.topics || []).map((t) => ({
          library_topic_id: t.id,
          chapter_number: t.chapter_number || null,
          topic_title: t.title || "",
        })),
        date: lesson.planned_date || "",
        startTime: lesson.planned_time ? lesson.planned_time.slice(0, 5) : "09:00",
        endTime: lesson.end_time ? lesson.end_time.slice(0, 5) : "10:00",
        classIds: lesson.class_ids || [],
        title: lesson.title || "",
        description: lesson.description || "",
        status: lesson.status || "planned",
      });
    }
  }, [lesson]);

  // Load topics when bookId is set
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
        const chapters = [
          ...(bookData.approved_chapters || []),
          ...(bookData.custom_chapters || []),
        ].map((ch) => ({
          id: ch.id,
          chapter_number: ch.chapter_number,
          title: ch.title,
          topics: (ch.topics || []).map((t) => ({
            id: t.id,
            title: t.title,
            chapter_number: ch.chapter_number,
          })),
        }));
        setBooksWithTopics([{ id: formData.bookId, chapters }]);
      }
    } catch {
      toast.error("Failed to load book details");
    } finally {
      setLoadingTopics(false);
    }
  };

  if (!lesson) return null;

  const uniqueBooks = assignedBooks.reduce((acc, book) => {
    if (!acc.find((b) => b.id === book.id)) acc.push(book);
    return acc;
  }, []);

  const steps = [
    { id: 1, label: "Book" },
    { id: 2, label: "Topics" },
    { id: 3, label: "Date" },
    { id: 4, label: "Classes" },
    { id: 5, label: "Details" },
  ];

  const handleNext = () => {
    if (step === 1 && !formData.bookId) {
      toast.error("Please select a book"); return;
    }
    if (step === 2 && formData.topics.length === 0) {
      toast.error("Please select at least one topic"); return;
    }
    if (step === 3 && (!formData.date || !formData.startTime || !formData.endTime)) {
      toast.error("Please select date, start time, and end time"); return;
    }
    if (step === 3 && formData.startTime >= formData.endTime) {
      toast.error("End time must be after start time"); return;
    }
    if (step === 4 && formData.classIds.length === 0) {
      toast.error("Please select at least one class"); return;
    }
    if (step < 5) setStep(step + 1);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!formData.date || formData.classIds.length === 0 || formData.topics.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await lessonService.updateLessonPlan(lesson.id, {
        planned_date: formData.date,
        planned_time: formData.startTime,
        end_time: formData.endTime,
        class_ids: formData.classIds,
        topics: formData.topics,
        title: formData.title || null,
        description: formData.description || null,
        status: formData.status,
      });
      toast.success("Lesson updated");
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update lesson");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const labelCls = "text-xs font-semibold text-gray-500 uppercase tracking-wide";
  const inputCls = "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">Edit Lesson Plan</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 px-6 py-4 border-b border-gray-100">
          {steps.map((s) => (
            <div key={s.id} className="flex-1">
              <div className={`h-1 rounded-full ${s.id <= step ? "bg-indigo-600" : "bg-gray-200"}`} />
              <p className="text-xs mt-1 text-gray-600 text-center">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 min-h-64">

          {/* Step 1: Book */}
          {step === 1 && (
            <div className="space-y-3">
              <label className="block">
                <span className={labelCls}>Assigned Book</span>
                <select
                  value={formData.bookId}
                  onChange={(e) => setFormData((p) => ({ ...p, bookId: e.target.value, topics: [] }))}
                  className={inputCls}
                >
                  <option value="">Select a book...</option>
                  {uniqueBooks.map((b) => (
                    <option key={b.id} value={b.id}>{b.book_title} ({b.subject_name})</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Step 2: Topics */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-900">
                Select topics from <strong>{uniqueBooks.find((b) => b.id === formData.bookId)?.book_title}</strong>
              </p>
              <TopicSelector
                bookId={formData.bookId}
                assignedBooks={booksWithTopics}
                selectedTopics={formData.topics}
                onTopicsChange={(topics) => setFormData((p) => ({ ...p, topics }))}
                loading={loadingTopics}
              />
            </div>
          )}

          {/* Step 3: Date & Time */}
          {step === 3 && (
            <div className="space-y-4">
              <label className="block">
                <span className={labelCls}>Lesson Date</span>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                  className={inputCls}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Start Time</span>
                  <input type="time" value={formData.startTime}
                    onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))}
                    className={inputCls} />
                </label>
                <label className="block">
                  <span className={labelCls}>End Time</span>
                  <input type="time" value={formData.endTime}
                    onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))}
                    className={inputCls} />
                </label>
              </div>
              {formData.startTime && formData.endTime && formData.startTime < formData.endTime && (
                <p className="text-xs text-indigo-600 font-medium">
                  Duration: {(() => {
                    const [sh, sm] = formData.startTime.split(":").map(Number);
                    const [eh, em] = formData.endTime.split(":").map(Number);
                    const mins = (eh * 60 + em) - (sh * 60 + sm);
                    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? mins % 60 + "m" : ""}` : `${mins}m`;
                  })()}
                </p>
              )}
              {formData.startTime >= formData.endTime && formData.endTime && (
                <p className="text-xs text-red-500">End time must be after start time</p>
              )}
            </div>
          )}

          {/* Step 4: Classes */}
          {step === 4 && (
            <div className="space-y-3">
              <label className="block">
                <span className={labelCls}>Classes (Select at least one)</span>
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
                            setFormData((p) => ({
                              ...p,
                              classIds: e.target.checked
                                ? [...p.classIds, cls.id]
                                : p.classIds.filter((id) => id !== cls.id),
                            }));
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

          {/* Step 5: Details & Status */}
          {step === 5 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
                <p><span className="font-semibold">Book:</span> {uniqueBooks.find((b) => b.id === formData.bookId)?.book_title}</p>
                <p><span className="font-semibold">Topics:</span> {formData.topics.length} selected</p>
                <p><span className="font-semibold">Date & Time:</span> {formData.date} · {formData.startTime} – {formData.endTime}</p>
                <p><span className="font-semibold">Classes:</span> {assignedClasses.filter((c) => formData.classIds.includes(c.id)).map((c) => c.name).join(", ")}</p>
              </div>

              <label className="block">
                <span className={labelCls}>Status</span>
                <select value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))} className={inputCls}>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="postponed">Postponed</option>
                </select>
              </label>

              <label className="block">
                <span className={labelCls}>Lesson Title (Optional)</span>
                <input type="text" value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Introduction to Variables"
                  className={inputCls} />
              </label>

              <label className="block">
                <span className={labelCls}>Description (Optional)</span>
                <textarea value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Notes for this lesson..."
                  className={inputCls + " resize-none"} />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between gap-2">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 flex items-center gap-2"
          >
            {step === 1 ? "Cancel" : <><ChevronLeftIcon className="h-4 w-4" /> Previous</>}
          </button>

          {step < 5 ? (
            <button type="button" onClick={handleNext}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center gap-2">
              Next <ChevronRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={handleSave} disabled={saving}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
