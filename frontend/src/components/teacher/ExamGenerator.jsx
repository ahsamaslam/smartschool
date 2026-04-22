import { useState, useEffect } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import Button from "../common/Button";
import Dropdown from "../common/Dropdown";
import Alert from "../common/Alert";
import { QUIZ_CONFIG } from "../../utils/constants";
import toast from "react-hot-toast";

const COMPLEXITY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const TYPE_OPTIONS = QUIZ_CONFIG.QUESTION_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

/**
 * ExamGenerator — dynamic per-question-type rows (add/remove)
 * per business guide requirement
 */
export default function ExamGenerator({ classId, topics = [] }) {
  const { user } = useAuth();
  const [complexity, setComplexity] = useState("medium");
  const [rows, setRows] = useState([{ type: "mcq", count: 10 }]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const addRow = () => {
    setRows((prev) => [...prev, { type: "short_answer", count: 5 }]);
  };

  const removeRow = (idx) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!topics.length) {
      setError("No topics selected.");
      return;
    }
    setError("");
    setResult(null);
    setGenerating(true);

    const exam_format = rows.reduce((acc, row) => {
      acc[row.type] = (acc[row.type] || 0) + Number(row.count);
      return acc;
    }, {});

    try {
      const res = await teacherService.generateExam(user.id, {
        class_id: classId,
        topic_ids: topics,
        complexity,
        exam_format,
      });
      setResult(res.data?.content || "");
      toast.success("Exam generated!");
    } catch {
      setError("Failed to generate exam. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    win.document.write(
      `<pre style="font-family:monospace;white-space:pre-wrap">${result}</pre>`,
    );
    win.print();
  };

  return (
    <div className="space-y-5">
      {error && <Alert type="error" message={error} />}

      {/* Complexity */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Complexity
        </label>
        <Dropdown
          options={COMPLEXITY_OPTIONS}
          value={complexity}
          onChange={setComplexity}
          placeholder="Select complexity…"
        />
      </div>

      {/* Dynamic question-type rows */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question Breakdown
        </label>
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="flex-1">
                <Dropdown
                  options={TYPE_OPTIONS}
                  value={row.type}
                  onChange={(v) => updateRow(idx, "type", v)}
                />
              </div>
              <input
                type="number"
                min={1}
                max={50}
                value={row.count}
                onChange={(e) => updateRow(idx, "count", e.target.value)}
                className="w-20 border border-gray-300 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
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
          className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          <PlusIcon className="h-4 w-4" />
          Add question type
        </button>
      </div>

      <Button
        variant="primary"
        fullWidth
        onClick={handleGenerate}
        loading={generating}
      >
        Generate Exam
      </Button>

      {/* Result */}
      {result && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">
              Generated Exam
            </h3>
            <button
              onClick={handlePrint}
              className="text-xs text-blue-600 underline hover:text-blue-700"
            >
              Print / Download
            </button>
          </div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-mono overflow-auto max-h-96">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
