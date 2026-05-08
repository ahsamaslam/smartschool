import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/useAuth";
import examService from "../../services/examService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import ExamCreateModal from "../../components/teacher/ExamCreateModal";
import toast from "react-hot-toast";

const STATUS_BADGE = {
  draft: "bg-amber-100 text-amber-700",
  finalized: "bg-green-100 text-green-700",
};

const COMPLEXITY_BADGE = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-blue-50 text-blue-700",
  hard: "bg-red-50 text-red-700",
};

export default function ExamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    if (!user?.id) return;
    setLoading(true);
    examService
      .getExams(user.id)
      .then((res) => setExams(res.data || []))
      .catch(() => setError("Failed to load exams."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [user?.id]);

  const handleDelete = async (e, examId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this exam and all its questions?")) return;
    setDeletingId(examId);
    try {
      await examService.deleteExam(examId, user.id);
      toast.success("Exam deleted.");
      setExams((p) => p.filter((ex) => ex.id !== examId));
    } catch {
      toast.error("Failed to delete exam.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreated = (newExam) => {
    navigate(`/teacher/exams/${newExam.id}`);
  };

  if (loading) return <PageSpinner />;

  const total = exams.length;
  const drafts = exams.filter((e) => e.status === "draft").length;
  const finalized = exams.filter((e) => e.status === "finalized").length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI-powered exam papers grounded in your course syllabus.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <PlusIcon className="h-4 w-4" />
          Create Exam
        </Button>
      </div>

      {error && <Alert type="error" message={error} className="mt-4 mb-2" />}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 my-6">
        <StatCard
          label="Total Exams"
          value={total}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="Draft"
          value={drafts}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatCard
          label="Finalized"
          value={finalized}
          color="text-green-600"
          bg="bg-green-50"
        />
      </div>

      {/* Empty state */}
      {exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <DocumentTextIcon className="h-16 w-16 text-gray-200 mb-4" />
          <p className="text-gray-500 font-medium mb-1">No exams yet</p>
          <p className="text-sm text-gray-400 mb-6">
            Create your first AI-powered exam paper.
          </p>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <PlusIcon className="h-4 w-4" />
            Create Exam
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map((exam) => (
            <div
              key={exam.id}
              onClick={() => navigate(`/teacher/exams/${exam.id}`)}
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
            >
              {/* Title + status */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                  {exam.title}
                </h3>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    STATUS_BADGE[exam.status] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {exam.status || "draft"}
                </span>
              </div>

              {/* Class · Subject */}
              <p className="text-xs text-blue-600 font-medium mb-3 truncate">
                {exam.class_name || "—"} · {exam.subject_name || "—"}
              </p>

              {/* Meta chips */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    COMPLEXITY_BADGE[exam.complexity] ||
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {exam.complexity}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {exam.question_count || 0} questions
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {exam.total_marks || 0} marks
                </span>
              </div>

              {/* Date + actions */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {exam.created_at
                    ? new Date(exam.created_at).toLocaleDateString()
                    : ""}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/teacher/exams/${exam.id}`);
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg font-medium transition-colors"
                  >
                    <PencilSquareIcon className="h-3.5 w-3.5" />
                    Open
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, exam.id)}
                    disabled={deletingId === exam.id}
                    className="flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ExamCreateModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div className={`rounded-2xl ${bg} px-5 py-4`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
