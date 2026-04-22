import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import quizService from "../../services/quizService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import clsx from "clsx";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

export default function QuizResults() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!attemptId) return;
    quizService
      .getAttemptResult(attemptId)
      .then((res) => setResult(res.data))
      .catch(() => setError("Failed to load results."))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <PageSpinner />;
  if (error)
    return (
      <div className="p-6">
        <Alert type="error" message={error} />
      </div>
    );

  const score = result?.score ?? 0;
  const maxScore = result?.total_points ?? 100;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = percentage >= 60;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-12 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        {/* Result header */}
        <div className="text-center mb-8">
          {passed ? (
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-3" />
          ) : (
            <XCircleIcon className="h-16 w-16 text-red-400 mx-auto mb-3" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            {passed ? "Well Done!" : "Keep Practising"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {passed
              ? "You passed this quiz."
              : "You can attempt this quiz again."}
          </p>
        </div>

        {/* Score badge */}
        <div className="flex items-center justify-center mb-8">
          <div
            className={clsx(
              "w-32 h-32 rounded-full flex flex-col items-center justify-center border-4",
              passed
                ? "border-green-400 bg-green-50"
                : "border-red-300 bg-red-50",
            )}
          >
            <span
              className={clsx(
                "text-4xl font-bold tabular-nums",
                passed ? "text-green-600" : "text-red-500",
              )}
            >
              {percentage}
            </span>
            <span className="text-xs text-gray-500">%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <Stat label="Score" value={`${score} / ${maxScore}`} />
          <Stat label="Attempt" value={`#${result?.attempt_number ?? 1}`} />
          <Stat
            label="Status"
            value={passed ? "Passed" : "Failed"}
            color={passed ? "text-green-600" : "text-red-500"}
          />
        </div>

        {/* Per-question breakdown */}
        {result?.breakdown?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">
              Question Breakdown
            </h2>
            <div className="space-y-2">
              {result.breakdown.map((item, i) => (
                <div
                  key={i}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                    item.correct ? "bg-green-50" : "bg-red-50",
                  )}
                >
                  {item.correct ? (
                    <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircleIcon className="h-4 w-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className="flex-1 truncate text-gray-800">
                    Q{i + 1}: {item.question_text}
                  </span>
                  <span className="text-gray-400 font-medium">
                    {item.points_earned}/{item.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-2)}
            className="flex-1 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to Lesson
          </button>
          <button
            onClick={() => navigate("/student/dashboard")}
            className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color = "text-gray-900" }) {
  return (
    <div>
      <p className={clsx("text-lg font-bold tabular-nums", color)}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
