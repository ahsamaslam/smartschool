import { useState, useEffect } from "react";
import adminService from "../../services/adminService";
import Button from "../common/Button";
import Alert from "../common/Alert";
import { CpuChipIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

const SCOPE_OPTIONS = [
  { value: "all", label: "All Curriculum" },
  { value: "subjects", label: "Subjects Only" },
  { value: "topics", label: "Topics Only" },
  { value: "videos", label: "Videos Only" },
];

/**
 * ModelTrainer — Admin can select curriculum scope and push it
 * as context to Claude API (Option A: context injection).
 * Does not fine-tune; seeds Claude's conversation context.
 */
export default function ModelTrainer() {
  const [scope, setScope] = useState("all");
  const [training, setTraining] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleTrain = async () => {
    setTraining(true);
    setError("");
    setSuccess(false);
    try {
      await adminService.trainModel({ scope });
      setSuccess(true);
      toast.success("Model context updated!");
    } catch {
      setError("Training failed. Please try again.");
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <CpuChipIcon className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Train AI Model</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Push curriculum data as context to Claude AI so it can answer
            student questions with school-specific knowledge.
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
          <CheckCircleIcon className="h-4 w-4" />
          Model context updated successfully.
        </div>
      )}

      {/* Scope selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data Scope
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setScope(opt.value)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                scope === opt.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        fullWidth
        onClick={handleTrain}
        loading={training}
      >
        {training ? "Updating AI Context…" : "Train Model"}
      </Button>

      <p className="text-xs text-gray-400 text-center">
        This operation pushes curriculum metadata to the Claude AI context
        store. Data is never used to fine-tune the underlying model.
      </p>
    </div>
  );
}
