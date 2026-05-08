import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  ArrowPathIcon,
  PrinterIcon,
  CheckIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/useAuth";
import examService from "../../services/examService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Dropdown from "../../components/common/Dropdown";
import {
  EXAM_QUESTION_TYPES,
  EXAM_COMPLEXITY_OPTIONS,
  EXAM_FONT_SIZE_OPTIONS,
} from "../../utils/constants";
import toast from "react-hot-toast";

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_ORDER = ["mcq", "fill_in_blank", "short_answer", "long_answer"];
const TYPE_LABEL = {
  mcq: "Multiple Choice (MCQ)",
  short_answer: "Short Answer",
  long_answer: "Long Question",
  fill_in_blank: "Fill in the Blank",
};
const COMPLEXITY_BADGE = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-blue-50 text-blue-700",
  hard: "bg-red-50 text-red-700",
};
const STATUS_BADGE = {
  draft: "bg-amber-100 text-amber-700",
  finalized: "bg-green-100 text-green-700",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupByType(questions) {
  const grouped = {};
  TYPE_ORDER.forEach((t) => (grouped[t] = []));
  questions.forEach((q) => {
    if (!grouped[q.question_type]) grouped[q.question_type] = [];
    grouped[q.question_type].push(q);
  });
  return grouped;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExamEditor() {
  const { examId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ai"); // "ai" | "manual"
  const [regenerating, setRegenerating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const printRef = useRef(null);

  const load = () => {
    setLoading(true);
    examService
      .getExam(examId)
      .then((res) => {
        const data = res.data;
        setExam(data);
        setQuestions(data.questions || []);
      })
      .catch(() => setError("Failed to load exam."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [examId]);

  // ── Regenerate ───────────────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    if (
      !window.confirm(
        "This will replace ALL questions with new AI-generated ones. Continue?",
      )
    )
      return;
    setRegenerating(true);
    try {
      const res = await examService.regenerateExam(examId, user.id);
      setQuestions(res.data.questions || []);
      toast.success("Questions regenerated!");
    } catch {
      toast.error("Failed to regenerate. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  // ── Status toggle ────────────────────────────────────────────────────────────
  const handleStatusToggle = async () => {
    const newStatus = exam?.status === "finalized" ? "draft" : "finalized";
    setSavingStatus(true);
    try {
      const res = await examService.updateExam(examId, { status: newStatus });
      setExam(res.data);
      toast.success(`Exam marked as ${newStatus}.`);
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setSavingStatus(false);
    }
  };

  // ── Delete question ──────────────────────────────────────────────────────────
  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm("Remove this question?")) return;
    setDeletingId(qId);
    try {
      await examService.deleteQuestion(examId, qId);
      setQuestions((p) => p.filter((q) => q.id !== qId));
      toast.success("Question removed.");
    } catch {
      toast.error("Failed to remove question.");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Save edited question ─────────────────────────────────────────────────────
  const handleSaveQuestion = async (qId, data) => {
    try {
      const res = await examService.updateQuestion(examId, qId, data);
      setQuestions((p) => p.map((q) => (q.id === qId ? res.data : q)));
      setEditingId(null);
      toast.success("Question updated.");
    } catch {
      toast.error("Failed to save question.");
    }
  };

  // ── Add manual question ──────────────────────────────────────────────────────
  const handleAddQuestion = async (data) => {
    try {
      const res = await examService.addQuestion(examId, data);
      setQuestions((p) => [...p, res.data]);
      setShowAddForm(false);
      toast.success("Question added.");
    } catch {
      toast.error("Failed to add question.");
    }
  };

  // ── Print ────────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // ── Move question (manual reorder) ───────────────────────────────────────────
  const moveQuestion = async (qId, direction) => {
    const idx = questions.findIndex((q) => q.id === qId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setQuestions(updated);
  };

  if (loading) return <PageSpinner />;
  if (!exam) return <Alert type="error" message="Exam not found." />;

  const grouped = groupByType(questions);
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);
  const typesUsed = TYPE_ORDER.filter((t) => grouped[t]?.length > 0);

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { background: white; }
        }
        @media screen {
          .print-area { display: none; }
        }
      `}</style>

      {/* ── Screen View ── */}
      <div className="no-print p-6 max-w-5xl mx-auto">
        {/* Back */}
        <Link
          to="/teacher/exams"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-5"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          My Exams
        </Link>

        {error && <Alert type="error" message={error} className="mb-4" />}

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-gray-900 truncate">
                  {exam.title}
                </h1>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${
                    STATUS_BADGE[exam.status] || "bg-gray-100 text-gray-500"
                  }`}
                >
                  {exam.status || "draft"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <MetaChip label={exam.class_name || "—"} />
                <MetaChip label={exam.subject_name || "—"} />
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${
                    COMPLEXITY_BADGE[exam.complexity] ||
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {exam.complexity}
                </span>
                <MetaChip label={`${questions.length} questions`} />
                <MetaChip label={`${totalMarks} marks`} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRegenerate}
                loading={regenerating}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Regenerate
              </Button>
              <Button
                variant={exam.status === "finalized" ? "secondary" : "success"}
                size="sm"
                onClick={handleStatusToggle}
                loading={savingStatus}
              >
                {exam.status === "finalized" ? "Unfinalize" : "Finalize"}
              </Button>
              <Button variant="primary" size="sm" onClick={handlePrint}>
                <PrinterIcon className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {[
            { key: "ai", label: "AI Generated" },
            { key: "manual", label: "Manual Builder" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── AI Tab ── */}
        {activeTab === "ai" && (
          <div className="space-y-8">
            {typesUsed.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">No questions yet. Try regenerating.</p>
              </div>
            ) : (
              typesUsed.map((type) => (
                <QuestionSection
                  key={type}
                  type={type}
                  questions={grouped[type]}
                  editingId={editingId}
                  deletingId={deletingId}
                  onEdit={setEditingId}
                  onSave={handleSaveQuestion}
                  onDelete={handleDeleteQuestion}
                  onMove={moveQuestion}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))
            )}

            {/* Add Question */}
            {showAddForm ? (
              <AddQuestionForm
                onAdd={handleAddQuestion}
                onCancel={() => setShowAddForm(false)}
              />
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Add Question Manually
              </button>
            )}
          </div>
        )}

        {/* ── Manual Builder Tab ── */}
        {activeTab === "manual" && (
          <ManualBuilderTab
            examId={examId}
            questions={questions}
            onAdd={handleAddQuestion}
            onDelete={handleDeleteQuestion}
            onSave={handleSaveQuestion}
          />
        )}
      </div>

      {/* ── Print Area (hidden on screen) ── */}
      <div className="print-area" ref={printRef}>
        <PrintView exam={exam} questions={questions} />
      </div>
    </>
  );
}

// ── QuestionSection ────────────────────────────────────────────────────────────
function QuestionSection({
  type,
  questions,
  editingId,
  deletingId,
  onEdit,
  onSave,
  onDelete,
  onMove,
  onCancelEdit,
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
          {TYPE_LABEL[type] || type}
        </h2>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
          {questions.length}
        </span>
      </div>
      <div className="space-y-3">
        {questions.map((q, qIdx) => (
          <QuestionCard
            key={q.id}
            question={q}
            globalIndex={qIdx + 1}
            isEditing={editingId === q.id}
            isDeleting={deletingId === q.id}
            onEdit={() => onEdit(q.id)}
            onSave={(data) => onSave(q.id, data)}
            onDelete={() => onDelete(q.id)}
            onMoveUp={() => onMove(q.id, "up")}
            onMoveDown={() => onMove(q.id, "down")}
            onCancel={onCancelEdit}
          />
        ))}
      </div>
    </div>
  );
}

// ── QuestionCard ───────────────────────────────────────────────────────────────
function QuestionCard({
  question,
  globalIndex,
  isEditing,
  isDeleting,
  onEdit,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  onCancel,
}) {
  const [form, setForm] = useState({
    question_text: question.question_text || "",
    options: question.options || { A: "", B: "", C: "", D: "" },
    correct_answer: question.correct_answer || "",
    marks: question.marks || 1,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setForm({
        question_text: question.question_text || "",
        options: question.options || { A: "", B: "", C: "", D: "" },
        correct_answer: question.correct_answer || "",
        marks: question.marks || 1,
      });
    }
  }, [isEditing, question]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      question_text: form.question_text,
      correct_answer: form.correct_answer,
      marks: Number(form.marks),
    };
    if (
      question.question_type === "mcq" ||
      question.question_type === "fill_in_blank"
    ) {
      payload.options = form.options;
    }
    await onSave(payload);
    setSaving(false);
  };

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl border-2 border-blue-300 p-5 shadow-sm">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Question
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none"
              value={form.question_text}
              onChange={(e) =>
                setForm((f) => ({ ...f, question_text: e.target.value }))
              }
            />
          </div>

          {question.question_type === "mcq" && (
            <div className="grid grid-cols-2 gap-2">
              {["A", "B", "C", "D"].map((opt) => (
                <div key={opt}>
                  <label className="text-xs text-gray-500 mb-0.5 block">
                    {opt}.
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.options?.[opt] || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        options: { ...f.options, [opt]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                {question.question_type === "mcq"
                  ? "Correct Option (A/B/C/D)"
                  : "Correct Answer / Model Answer"}
              </label>
              {question.question_type === "long_answer" ? (
                <textarea
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] resize-none"
                  value={form.correct_answer}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, correct_answer: e.target.value }))
                  }
                />
              ) : (
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.correct_answer}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, correct_answer: e.target.value }))
                  }
                />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Marks
              </label>
              <input
                type="number"
                min={1}
                className="w-16 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.marks}
                onChange={(e) =>
                  setForm((f) => ({ ...f, marks: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saving}
            >
              <CheckIcon className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <XMarkIcon className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 group hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-3">
        {/* Number badge */}
        <div className="shrink-0 w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold mt-0.5">
          {globalIndex}
        </div>

        <div className="flex-1 min-w-0">
          {/* Question text */}
          <p className="text-sm text-gray-800 leading-relaxed mb-2">
            {question.question_text}
          </p>

          {/* MCQ options */}
          {question.question_type === "mcq" && question.options && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
              {Object.entries(question.options).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-semibold ${
                      question.correct_answer === key
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                  >
                    {key}.
                  </span>
                  <span
                    className={`text-xs ${
                      question.correct_answer === key
                        ? "text-green-700 font-medium"
                        : "text-gray-600"
                    }`}
                  >
                    {val}
                  </span>
                  {question.correct_answer === key && (
                    <CheckIcon className="h-3 w-3 text-green-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Fill in blank answer */}
          {question.question_type === "fill_in_blank" && (
            <p className="text-xs text-gray-500 mt-1">
              Answer:{" "}
              <span className="text-green-600 font-medium">
                {question.correct_answer}
              </span>
            </p>
          )}

          {/* Short answer model */}
          {question.question_type === "short_answer" &&
            question.correct_answer && (
              <p className="text-xs text-gray-400 italic mt-1 line-clamp-2">
                Model: {question.correct_answer}
              </p>
            )}

          {/* Long answer rubric */}
          {question.question_type === "long_answer" &&
            question.correct_answer && (
              <p className="text-xs text-gray-400 italic mt-1 line-clamp-2">
                Rubric: {question.correct_answer}
              </p>
            )}
        </div>

        {/* Marks + actions */}
        <div className="shrink-0 flex flex-col items-end gap-1.5 ml-2">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
            {question.marks || 1} mk
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onMoveUp}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Move up"
            >
              <ChevronUpIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onMoveDown}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Move down"
            >
              <ChevronDownIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onEdit}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="Delete"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AddQuestionForm ────────────────────────────────────────────────────────────
function AddQuestionForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({
    question_type: "mcq",
    question_text: "",
    options: { A: "", B: "", C: "", D: "" },
    correct_answer: "",
    marks: 1,
    fontSize: "base",
  });
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!form.question_text.trim()) return;
    setAdding(true);
    const payload = {
      question_type: form.question_type,
      question_text: form.question_text.trim(),
      correct_answer: form.correct_answer,
      marks: Number(form.marks),
    };
    if (form.question_type === "mcq") {
      payload.options = form.options;
    }
    await onAdd(payload);
    setAdding(false);
  };

  const needsOptions = form.question_type === "mcq";

  return (
    <div className="border-2 border-dashed border-blue-200 rounded-2xl p-5 bg-blue-50/30">
      <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-4">
        Add Question
      </p>
      <div className="space-y-3">
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <Dropdown
              label="Type"
              options={EXAM_QUESTION_TYPES}
              value={form.question_type}
              onChange={(v) => setForm((f) => ({ ...f, question_type: v }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Font Size
            </label>
            <div className="flex gap-1">
              {EXAM_FONT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setForm((f) => ({ ...f, fontSize: opt.value }))
                  }
                  className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    form.fontSize === opt.value
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-6">
            <input
              type="number"
              min={1}
              max={20}
              value={form.marks}
              onChange={(e) =>
                setForm((f) => ({ ...f, marks: e.target.value }))
              }
              className="w-16 border border-gray-300 rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Marks"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Question Text
          </label>
          <textarea
            className={`w-full border border-gray-300 rounded-xl p-3 text-${form.fontSize} focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none`}
            placeholder={
              form.question_type === "fill_in_blank"
                ? 'Use ___ for the blank, e.g. "The capital of France is ___."'
                : "Enter question text…"
            }
            value={form.question_text}
            onChange={(e) =>
              setForm((f) => ({ ...f, question_text: e.target.value }))
            }
          />
        </div>

        {needsOptions && (
          <div className="grid grid-cols-2 gap-2">
            {["A", "B", "C", "D"].map((opt) => (
              <div key={opt}>
                <label className="text-xs text-gray-500 mb-0.5 block">
                  {opt}.
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.options?.[opt] || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      options: { ...f.options, [opt]: e.target.value },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            {form.question_type === "mcq"
              ? "Correct Option (e.g. A)"
              : form.question_type === "fill_in_blank"
                ? "Correct Answer (word/phrase)"
                : form.question_type === "long_answer"
                  ? "Marking Rubric / Model Answer"
                  : "Model Answer"}
          </label>
          {form.question_type === "long_answer" ? (
            <textarea
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] resize-none"
              value={form.correct_answer}
              onChange={(e) =>
                setForm((f) => ({ ...f, correct_answer: e.target.value }))
              }
            />
          ) : (
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.correct_answer}
              onChange={(e) =>
                setForm((f) => ({ ...f, correct_answer: e.target.value }))
              }
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            loading={adding}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Question
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── ManualBuilderTab ───────────────────────────────────────────────────────────
function ManualBuilderTab({ examId, questions, onAdd, onDelete, onSave }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (qId) => {
    if (!window.confirm("Remove this question?")) return;
    setDeletingId(qId);
    await onDelete(qId);
    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Build your paper manually — add, edit, or remove questions at any time.
      </p>

      {questions.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 text-center py-10">
          No questions yet. Add your first question below.
        </p>
      )}

      {questions.map((q, idx) => (
        <QuestionCard
          key={q.id}
          question={q}
          globalIndex={idx + 1}
          isEditing={editingId === q.id}
          isDeleting={deletingId === q.id}
          onEdit={() => setEditingId(q.id)}
          onSave={async (data) => {
            await onSave(q.id, data);
            setEditingId(null);
          }}
          onDelete={() => handleDelete(q.id)}
          onMoveUp={() => {}}
          onMoveDown={() => {}}
          onCancel={() => setEditingId(null)}
        />
      ))}

      {showAdd ? (
        <AddQuestionForm
          onAdd={async (data) => {
            await onAdd(data);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Question
        </button>
      )}
    </div>
  );
}

// ── PrintView ─────────────────────────────────────────────────────────────────
function PrintView({ exam, questions }) {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);
  const grouped = groupByType(questions);
  const typesUsed = TYPE_ORDER.filter((t) => grouped[t]?.length > 0);

  // Flat numbered list
  let counter = 0;
  const numbered = [];
  typesUsed.forEach((type) => {
    grouped[type].forEach((q) => {
      counter++;
      numbered.push({ ...q, _num: counter });
    });
  });

  return (
    <div
      style={{
        fontFamily: "serif",
        padding: "40px",
        maxWidth: "800px",
        margin: "0 auto",
        color: "#000",
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          borderBottom: "2px solid #000",
          paddingBottom: "12px",
          marginBottom: "20px",
        }}
      >
        <p style={{ fontSize: "12px", margin: 0 }}>Smart School</p>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: "6px 0" }}>
          {exam.title}
        </h1>
        <p style={{ fontSize: "12px", margin: 0 }}>
          Class: {exam.class_name || "_______________"} &nbsp;|&nbsp; Subject:{" "}
          {exam.subject_name || "_______________"}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "12px",
          marginBottom: "20px",
        }}
      >
        <span>Date: {date}</span>
        <span>
          Total Marks: <strong>{totalMarks}</strong>
        </span>
        <span>Time: __________ minutes</span>
        <span>Student Name: ______________________________</span>
      </div>

      <div
        style={{
          fontSize: "12px",
          marginBottom: "20px",
          padding: "8px",
          border: "1px solid #ccc",
        }}
      >
        <strong>Instructions:</strong> Answer all questions. Write neatly. Show
        all working where required.
      </div>

      {/* Sections */}
      {typesUsed.map((type) => (
        <div key={type} style={{ marginBottom: "24px" }}>
          <h2
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              textTransform: "uppercase",
              borderBottom: "1px solid #000",
              paddingBottom: "4px",
              marginBottom: "12px",
            }}
          >
            Section: {TYPE_LABEL[type]}
          </h2>
          {grouped[type].map((q, idx) => {
            const num = numbered.find((n) => n.id === q.id)?._num || idx + 1;
            return (
              <div key={q.id} style={{ marginBottom: "16px" }}>
                <p
                  style={{
                    fontSize: "12px",
                    marginBottom: "6px",
                    fontWeight: "500",
                  }}
                >
                  Q{num}. [{q.marks || 1} mark{(q.marks || 1) !== 1 ? "s" : ""}]{" "}
                  {q.question_text}
                </p>

                {q.question_type === "mcq" && q.options && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "4px 24px",
                      paddingLeft: "20px",
                    }}
                  >
                    {Object.entries(q.options).map(([k, v]) => (
                      <p key={k} style={{ fontSize: "11px", margin: 0 }}>
                        ({k}) {v}
                      </p>
                    ))}
                  </div>
                )}

                {q.question_type === "fill_in_blank" && (
                  <p
                    style={{
                      fontSize: "11px",
                      paddingLeft: "20px",
                      color: "#555",
                    }}
                  >
                    Answer: ___________________________
                  </p>
                )}

                {q.question_type === "short_answer" && (
                  <div style={{ paddingLeft: "20px" }}>
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          borderBottom: "1px solid #ccc",
                          height: "22px",
                          marginBottom: "4px",
                        }}
                      />
                    ))}
                  </div>
                )}

                {q.question_type === "long_answer" && (
                  <div style={{ paddingLeft: "20px" }}>
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          borderBottom: "1px solid #ccc",
                          height: "22px",
                          marginBottom: "4px",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Answer Key — page break */}
      <div style={{ pageBreakBefore: "always", paddingTop: "20px" }}>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            textAlign: "center",
            borderBottom: "2px solid #000",
            paddingBottom: "8px",
            marginBottom: "16px",
          }}
        >
          ANSWER KEY — {exam.title}
        </h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "11px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6" }}>
              <th
                style={{
                  border: "1px solid #ccc",
                  padding: "6px 10px",
                  textAlign: "left",
                }}
              >
                Q#
              </th>
              <th
                style={{
                  border: "1px solid #ccc",
                  padding: "6px 10px",
                  textAlign: "left",
                }}
              >
                Question (truncated)
              </th>
              <th
                style={{
                  border: "1px solid #ccc",
                  padding: "6px 10px",
                  textAlign: "left",
                }}
              >
                Answer
              </th>
              <th
                style={{
                  border: "1px solid #ccc",
                  padding: "6px 10px",
                  textAlign: "center",
                }}
              >
                Marks
              </th>
            </tr>
          </thead>
          <tbody>
            {numbered.map((q) => (
              <tr key={q.id}>
                <td style={{ border: "1px solid #ccc", padding: "5px 10px" }}>
                  {q._num}
                </td>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "5px 10px",
                    maxWidth: "280px",
                    overflow: "hidden",
                  }}
                >
                  {q.question_text.length > 60
                    ? q.question_text.slice(0, 60) + "…"
                    : q.question_text}
                </td>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "5px 10px",
                    fontWeight: "600",
                  }}
                >
                  {q.correct_answer
                    ? q.correct_answer.length > 80
                      ? q.correct_answer.slice(0, 80) + "…"
                      : q.correct_answer
                    : "—"}
                </td>
                <td
                  style={{
                    border: "1px solid #ccc",
                    padding: "5px 10px",
                    textAlign: "center",
                  }}
                >
                  {q.marks || 1}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function MetaChip({ label }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
      {label}
    </span>
  );
}
