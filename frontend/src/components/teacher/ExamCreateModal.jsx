import { useState, useEffect } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Dropdown from "../common/Dropdown";
import Alert from "../common/Alert";
import {
  EXAM_QUESTION_TYPES,
  EXAM_COMPLEXITY_OPTIONS,
} from "../../utils/constants";
import examService from "../../services/examService";
import teacherService from "../../services/teacherService";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";

const DEFAULT_ROW = { type: "mcq", count: 5 };

export default function ExamCreateModal({ isOpen, onClose, onCreated }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1 — pattern
  const [rows, setRows] = useState([{ type: "mcq", count: 10 }]);

  // Step 2 — details
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [curriculum, setCurriculum] = useState([]); // [{id, name, topics:[]}]
  const [subjectId, setSubjectId] = useState("");
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [complexity, setComplexity] = useState("medium");
  const [title, setTitle] = useState("");

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setRows([{ type: "mcq", count: 10 }]);
      setClassId("");
      setCurriculum([]);
      setSubjectId("");
      setSelectedTopics([]);
      setComplexity("medium");
      setTitle("");
      setError("");
    }
  }, [isOpen]);

  // Load classes on step 2
  useEffect(() => {
    if (step !== 2 || !user?.id) return;
    setLoadingClasses(true);
    teacherService
      .getClasses(user.id)
      .then((res) => {
        const cls = res.data || [];
        setClasses(cls);
        if (cls.length) setClassId(cls[0].id);
      })
      .catch(() => setError("Failed to load classes."))
      .finally(() => setLoadingClasses(false));
  }, [step, user?.id]);

  // Load curriculum when class changes
  useEffect(() => {
    if (!classId) return;
    setLoadingCurriculum(true);
    setSubjectId("");
    setSelectedTopics([]);
    setCurriculum([]);
    examService
      .getClassCurriculum(classId)
      .then((res) => {
        const data = res.data || [];
        setCurriculum(data);
        if (data.length) setSubjectId(data[0].id);
      })
      .catch(() => setError("Failed to load subjects."))
      .finally(() => setLoadingCurriculum(false));
  }, [classId]);

  // Auto-suggest title when subject + complexity change
  useEffect(() => {
    const sub = curriculum.find((s) => s.id === subjectId);
    if (sub && complexity) {
      const labels = { easy: "Easy", medium: "Mid-Term", hard: "Final" };
      setTitle(`${labels[complexity] || ""} ${sub.name} Exam`);
    }
  }, [subjectId, complexity, curriculum]);

  // ── Row management ──────────────────────────────────────────────────────────
  const addRow = () => setRows((p) => [...p, { ...DEFAULT_ROW }]);
  const removeRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) =>
    setRows((p) => {
      const n = [...p];
      n[i] = { ...n[i], [field]: value };
      return n;
    });

  // ── Topic multi-select ──────────────────────────────────────────────────────
  const currentSubject = curriculum.find((s) => s.id === subjectId);
  const toggleTopic = (id) =>
    setSelectedTopics((p) =>
      p.includes(id) ? p.filter((t) => t !== id) : [...p, id],
    );
  const toggleAllTopics = () => {
    const all = (currentSubject?.topics || []).map((t) => t.id);
    setSelectedTopics((p) => (p.length === all.length ? [] : all));
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setError("");
    if (!classId) return setError("Please select a class.");
    if (!subjectId) return setError("Please select a subject.");
    if (!selectedTopics.length) return setError("Select at least one topic.");
    if (!title.trim()) return setError("Please enter an exam title.");

    const exam_format = rows.reduce((acc, r) => {
      if (Number(r.count) > 0)
        acc[r.type] = (acc[r.type] || 0) + Number(r.count);
      return acc;
    }, {});

    if (!Object.keys(exam_format).length)
      return setError("Add at least one question type.");

    setGenerating(true);
    try {
      const res = await examService.createExam({
        teacher_id: user.id,
        class_id: classId,
        subject_id: subjectId,
        topic_ids: selectedTopics,
        title: title.trim(),
        complexity,
        exam_format,
      });
      toast.success("Exam created successfully!");
      onCreated(res.data);
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        "Failed to generate exam. Please try again.";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const classOptions = classes.map((c) => ({ value: c.id, label: c.name }));
  const subjectOptions = curriculum.map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const totalQuestions = rows.reduce((s, r) => s + Number(r.count || 0), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Exam" size="xl">
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {[1, 2].map((s, idx) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {s}
              </div>
              <span
                className={`text-sm font-medium ${
                  step >= s ? "text-gray-800" : "text-gray-400"
                }`}
              >
                {s === 1 ? "Question Pattern" : "Details"}
              </span>
            </div>
            {idx === 0 && <div className="flex-1 h-px bg-gray-200 mx-3" />}
          </div>
        ))}
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
              Question Breakdown
            </p>
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1">
                    <Dropdown
                      options={EXAM_QUESTION_TYPES}
                      value={row.type}
                      onChange={(v) => updateRow(idx, "type", v)}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={row.count}
                      onChange={(e) => updateRow(idx, "count", e.target.value)}
                      className="w-20 border border-gray-300 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">Qs</span>
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <PlusIcon className="h-4 w-4" />
              Add question type
            </button>
          </div>

          {/* Summary pill */}
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-blue-700 font-medium">
              Total questions
            </span>
            <span className="text-lg font-bold text-blue-700">
              {totalQuestions}
            </span>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setError("");
                setStep(2);
              }}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Dropdown
              label="Class"
              options={classOptions}
              value={classId}
              onChange={setClassId}
              disabled={loadingClasses}
              placeholder={loadingClasses ? "Loading…" : "Select class…"}
            />
            <Dropdown
              label="Subject"
              options={subjectOptions}
              value={subjectId}
              onChange={(v) => {
                setSubjectId(v);
                setSelectedTopics([]);
              }}
              disabled={!classId || loadingCurriculum}
              placeholder={loadingCurriculum ? "Loading…" : "Select subject…"}
            />
          </div>

          {/* Topics multi-select */}
          {currentSubject && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Topics
                </label>
                <button
                  type="button"
                  onClick={toggleAllTopics}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedTopics.length === currentSubject.topics.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              </div>
              {currentSubject.topics.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center border rounded-xl">
                  No topics found for this subject.
                </p>
              ) : (
                <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                  {currentSubject.topics.map((t) => (
                    <label
                      key={t.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                        selectedTopics.includes(t.id)
                          ? "bg-blue-50 text-blue-800"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(t.id)}
                        onChange={() => toggleTopic(t.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {t.title}
                    </label>
                  ))}
                </div>
              )}
              {selectedTopics.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedTopics.length} topic
                  {selectedTopics.length !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}

          <Dropdown
            label="Complexity"
            options={EXAM_COMPLEXITY_OPTIONS}
            value={complexity}
            onChange={setComplexity}
          />

          <Input
            label="Exam Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mid-Term Physics Exam"
            required
          />

          {/* Pattern summary chips */}
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">
              Pattern
            </p>
            <div className="flex flex-wrap gap-2">
              {rows.map((r, i) => {
                const label =
                  EXAM_QUESTION_TYPES.find((t) => t.value === r.type)?.label ||
                  r.type;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full"
                  >
                    {r.count} × {label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between pt-1">
            <Button
              variant="secondary"
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              ← Back
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              loading={generating}
            >
              {generating ? "Generating…" : "Generate Exam"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
