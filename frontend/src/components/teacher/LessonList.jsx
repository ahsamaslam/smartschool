import { useState } from "react";
import { TrashIcon, CheckCircleIcon, PencilIcon, ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import lessonService from "../../services/lessonService";

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
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function LessonList({
  lessons = [],
  onEdit,
  onDelete,
  onMarkComplete,
  loading = false,
}) {
  const [sortBy, setSortBy] = useState("date");
  const [filterStatus, setFilterStatus] = useState("all");
  const [deletingLessonId, setDeletingLessonId] = useState(null);

  // Sort lessons
  let sortedLessons = [...lessons];
  if (sortBy === "date") {
    sortedLessons.sort(
      (a, b) => new Date(a.planned_date) - new Date(b.planned_date)
    );
  } else if (sortBy === "status") {
    const statusOrder = {
      completed: 0,
      in_progress: 1,
      planned: 2,
      postponed: 3,
    };
    sortedLessons.sort(
      (a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99)
    );
  }

  // Filter by status
  if (filterStatus !== "all") {
    sortedLessons = sortedLessons.filter((l) => l.status === filterStatus);
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-50 border-green-200 text-green-900";
      case "in_progress":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "postponed":
        return "bg-red-50 border-red-200 text-red-900";
      default:
        return "bg-blue-50 border-blue-200 text-blue-900";
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleIcon className="h-3 w-3" /> Completed</span>;
      case "in_progress":
        return <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">In Progress</span>;
      case "postponed":
        return <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Postponed</span>;
      default:
        return <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Planned</span>;
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "09:00";
    return timeStr;
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-500">
        Loading lesson plans...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters & Sort */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            <option value="date">Sort by Date</option>
            <option value="status">Sort by Status</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="postponed">Postponed</option>
          </select>
        </div>
        <p className="text-xs text-gray-600">
          {sortedLessons.length} lesson{sortedLessons.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Lessons List */}
      {sortedLessons.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 font-medium">No lesson plans yet</p>
          <p className="text-sm text-gray-500">Create your first lesson plan to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedLessons.map((lesson) => (
            <div
              key={lesson.id}
              className={`border rounded-lg p-4 space-y-3 transition ${getStatusColor(
                lesson.status
              )}`}
            >
              {/* Row 1: Date, Status, Actions */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    {formatDate(lesson.planned_date)} · {formatTime(lesson.planned_time)}{lesson.end_time ? ` – ${formatTime(lesson.end_time)}` : ""}
                  </p>
                  <p className="text-xs opacity-75">
                    {lesson.duration_minutes} minutes
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(lesson.status)}
                  <div className="flex gap-1">
                    {lesson.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onMarkComplete) {
                            onMarkComplete(lesson.id);
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-white/20 text-current"
                        title="Mark as completed"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (onEdit) {
                          onEdit(lesson);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-white/20 text-current"
                      title="Edit lesson"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingLessonId(lesson.id)}
                      className="p-2 rounded-lg hover:bg-white/20 text-current"
                      title="Delete lesson"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Title & Subject */}
              <div>
                {lesson.title && (
                  <p className="font-semibold text-sm">{lesson.title}</p>
                )}
                <p className="text-xs opacity-75">{lesson.subject_name}</p>
              </div>

              {/* Row 3: Classes */}
              <div className="flex flex-wrap gap-1">
                {lesson.class_names && lesson.class_names.length > 0 ? (
                  lesson.class_names.map((className) => (
                    <span
                      key={className}
                      className="inline-block px-2 py-1 rounded text-xs font-medium bg-white/40"
                    >
                      {className}
                    </span>
                  ))
                ) : (
                  <span className="text-xs opacity-75">No classes assigned</span>
                )}
              </div>

              {/* Row 4: Topics */}
              {lesson.topics && lesson.topics.length > 0 && (
                <div>
                  <p className="text-xs font-medium opacity-75 mb-1">
                    Topics ({lesson.topics.length}):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {lesson.topics.slice(0, 3).map((topic) => (
                      <span
                        key={topic.id}
                        className="inline-block px-2 py-1 rounded text-xs bg-white/40"
                        title={topic.title}
                      >
                        {topic.chapter_number && `Ch${topic.chapter_number}:`} {topic.title}
                      </span>
                    ))}
                    {lesson.topics.length > 3 && (
                      <span className="inline-block px-2 py-1 rounded text-xs bg-white/40">
                        +{lesson.topics.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {lesson.description && (
                <div className="pt-2 border-t border-current/20">
                  <p className="text-xs opacity-75">{lesson.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deletingLessonId && (
        <DeleteConfirmModal
          onConfirm={() => {
            if (onDelete) onDelete(deletingLessonId);
            setDeletingLessonId(null);
          }}
          onCancel={() => setDeletingLessonId(null)}
        />
      )}
    </div>
  );
}
