import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import homeworkService from "../../services/homeworkService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  DocumentArrowUpIcon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/24/outline";

const STATUS_COLORS = {
  published: "bg-emerald-50 text-emerald-800 border-emerald-200",
  draft: "bg-amber-50 text-amber-800 border-amber-200",
};

const TYPE_COLORS = {
  interactive: "bg-indigo-50 text-indigo-800 border-indigo-200",
  upload: "bg-violet-50 text-violet-800 border-violet-200",
};

export default function TeacherHomework() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClassId = searchParams.get("class_id");
  const [classes, setClasses] = useState([]);
  const [allHomework, setAllHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [publishing, setPublishing] = useState(null);

  // "New homework" class picker modal state
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [filterClass, setFilterClass] = useState(preselectedClassId || "all");

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const classesRes = await teacherService.getClasses(user.id);
      const classList = Array.isArray(classesRes.data) ? classesRes.data : [];
      setClasses(classList);

      const allHw = [];
      await Promise.all(
        classList.map(async (cls) => {
          try {
            const hwRes = await homeworkService.teacherList({ class_id: cls.id });
            const hwList = hwRes.data?.data || [];
            allHw.push(
              ...hwList.map((h) => ({
                ...h,
                class_id: cls.id,
                class_name: cls.name,
                branch_name: cls.branch_name,
              })),
            );
          } catch {
            /* skip class on error */
          }
        }),
      );
      setAllHomework(
        allHw.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      );
      if (preselectedClassId && classList.some((c) => c.id === preselectedClassId)) {
        setFilterClass(preselectedClassId);
      }
      setError("");
    } catch {
      setError("Failed to load homework.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleCreateNew = (classId) => {
    setShowClassPicker(false);
    navigate(`/teacher/classes/${classId}/homework/new`);
  };

  const handleDelete = async (hw) => {
    if (!window.confirm(`Delete "${hw.title}"? This cannot be undone.`)) return;
    setDeleting(hw.id);
    try {
      await homeworkService.remove(hw.id);
      toast.success("Homework deleted");
      setAllHomework((prev) => prev.filter((h) => h.id !== hw.id));
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const handlePublish = async (hw) => {
    setPublishing(hw.id);
    try {
      await homeworkService.publish(hw.id);
      toast.success("Published to students");
      setAllHomework((prev) =>
        prev.map((h) => (h.id === hw.id ? { ...h, status: "published" } : h)),
      );
    } catch (e) {
      const msg = e?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Publish failed — add questions for interactive homework");
    } finally {
      setPublishing(null);
    }
  };

  if (loading) return <PageSpinner />;

  const visibleClasses = filterClass === "all" ? allHomework : allHomework.filter((h) => h.class_id === filterClass);

  return (
    <div className="p-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homework</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create, edit, and publish assignments — interactive Q&amp;A or file uploads.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            if (classes.length === 0) return toast.error("No classes assigned to you yet.");
            if (classes.length === 1) return handleCreateNew(classes[0].id);
            setShowClassPicker(true);
          }}
        >
          <PlusIcon className="h-4 w-4 mr-1.5 inline -mt-0.5" />
          New Homework
        </Button>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Type legend */}
      <div className="flex flex-wrap gap-3 mb-5 text-xs">
        <span className="flex items-center gap-1.5 text-gray-600">
          <ChatBubbleBottomCenterTextIcon className="h-4 w-4 text-indigo-500" />
          Interactive — students answer questions directly
        </span>
        <span className="flex items-center gap-1.5 text-gray-600">
          <DocumentArrowUpIcon className="h-4 w-4 text-violet-500" />
          Upload — students submit files
        </span>
      </div>

      {/* Class filter */}
      {classes.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setFilterClass("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filterClass === "all"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            All classes
          </button>
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setFilterClass(cls.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filterClass === cls.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {cls.name}
            </button>
          ))}
        </div>
      )}

      {/* Homework list */}
      {visibleClasses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
          <ClipboardDocumentListIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">
            {classes.length === 0
              ? "You haven't been assigned to any classes yet."
              : "No homework created yet."}
          </p>
          {classes.length > 0 && (
            <p className="text-sm text-gray-400">
              Click <strong>New Homework</strong> to create your first assignment.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleClasses.map((hw) => (
            <HomeworkRow
              key={`${hw.class_id}-${hw.id}`}
              hw={hw}
              onEdit={() => navigate(`/teacher/classes/${hw.class_id}/homework/${hw.id}/edit`)}
              onSubmissions={() => navigate(`/teacher/classes/${hw.class_id}/homework/${hw.id}/submissions`)}
              onDelete={() => handleDelete(hw)}
              onPublish={() => handlePublish(hw)}
              deleting={deleting === hw.id}
              publishing={publishing === hw.id}
            />
          ))}
        </div>
      )}

      {/* Class picker modal */}
      {showClassPicker && (
        <ClassPickerModal
          classes={classes}
          onSelect={handleCreateNew}
          onClose={() => setShowClassPicker(false)}
        />
      )}
    </div>
  );
}

function HomeworkRow({ hw, onEdit, onSubmissions, onDelete, onPublish, deleting, publishing }) {
  const due = hw.due_at
    ? new Date(hw.due_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="mt-0.5 shrink-0">
            {hw.homework_type === "interactive" ? (
              <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-indigo-400" />
            ) : (
              <DocumentArrowUpIcon className="h-5 w-5 text-violet-400" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="text-xs text-gray-500">{hw.class_name}</p>
              {hw.branch_name && (
                <>
                  <span className="text-gray-300">·</span>
                  <p className="text-xs text-gray-400">{hw.branch_name}</p>
                </>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-base">{hw.title}</h3>
            {hw.topic_title && (
              <p className="text-xs text-gray-500 mt-0.5">Topic: {hw.topic_title}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  TYPE_COLORS[hw.homework_type] || TYPE_COLORS.interactive
                }`}
              >
                {hw.homework_type}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  STATUS_COLORS[hw.status] || STATUS_COLORS.draft
                }`}
              >
                {hw.status}
              </span>
              {due && (
                <span className="text-xs text-gray-500">Due: {due}</span>
              )}
              {hw.total_marks != null && (
                <span className="text-xs text-gray-500">Marks: {hw.total_marks}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-1 px-4 py-2.5 border-t border-gray-100 bg-gray-50/70 rounded-b-xl">
        <ActionBtn icon={<PencilSquareIcon className="h-3.5 w-3.5" />} onClick={onEdit} label="Edit" color="indigo" />
        <ActionBtn icon={<EyeIcon className="h-3.5 w-3.5" />} onClick={onSubmissions} label="Submissions" color="teal" />
        {hw.status === "draft" && (
          <ActionBtn
            icon={<ClipboardDocumentListIcon className="h-3.5 w-3.5" />}
            onClick={onPublish}
            label={publishing ? "Publishing…" : "Publish"}
            color="emerald"
            disabled={publishing}
          />
        )}
        <ActionBtn
          icon={<TrashIcon className="h-3.5 w-3.5" />}
          onClick={onDelete}
          label={deleting ? "Deleting…" : "Delete"}
          color="red"
          disabled={deleting}
        />
      </div>
    </div>
  );
}

function ActionBtn({ icon, onClick, label, color, disabled }) {
  const colors = {
    indigo: "text-indigo-600 hover:bg-indigo-50 border-indigo-100",
    teal: "text-teal-700 hover:bg-teal-50 border-teal-100",
    emerald: "text-emerald-700 hover:bg-emerald-50 border-emerald-100",
    red: "text-red-600 hover:bg-red-50 border-red-100",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
        colors[color] || colors.indigo
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ClassPickerModal({ classes, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Select a class</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Homework is linked to a class. Which class is this assignment for?
        </p>
        <div className="space-y-2">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => onSelect(cls.id)}
              className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
            >
              <p className="font-semibold text-gray-900 group-hover:text-indigo-700">
                {cls.name}
              </p>
              {cls.branch_name && (
                <p className="text-xs text-gray-500 mt-0.5">{cls.branch_name}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
