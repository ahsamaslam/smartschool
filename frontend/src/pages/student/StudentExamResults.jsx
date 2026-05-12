import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import examService from "../../services/examService";
import { PageSpinner } from "../../components/common/Spinner";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";

export default function StudentExamResults() {
  const { examId } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await examService.getMyResult(examId);
        if (!cancel) setResult(res.data);
      } catch (err) {
        if (!cancel) {
          toast.error(err?.response?.data?.detail || "Results not found.");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [examId]);

  if (loading) return <PageSpinner />;

  if (!result) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link to="/student/exams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ArrowLeftIcon className="h-4 w-4" /> Back to exams
        </Link>
        <p className="text-center text-gray-400 py-20">Results not available.</p>
      </div>
    );
  }

  const pct = result.percentage ?? 0;
  const passed = result.passed;
  const scoreColor = passed ? "text-green-600" : "text-red-600";
  const scoreBg = passed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200";

  return (
    <div className="p-6 max-w-3xl mx-auto pb-24">
      <Link to="/student/exams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeftIcon className="h-4 w-4" /> Back to exams
      </Link>

      {/* Score Card */}
      <div className={`rounded-2xl border p-8 text-center mb-8 ${scoreBg}`}>
        <div className="flex justify-center mb-4">
          {passed
            ? <CheckCircleSolid className="h-16 w-16 text-green-500" />
            : <XCircleIcon className="h-16 w-16 text-red-400" />
          }
        </div>
        <p className={`text-5xl font-black tabular-nums mb-1 ${scoreColor}`}>{pct}%</p>
        <p className={`text-lg font-bold mb-1 ${scoreColor}`}>{passed ? "Passed!" : "Not Passed"}</p>
        <p className="text-sm text-gray-500">
          {result.score} / {result.total_marks} marks
        </p>
        {result.submitted_at && (
          <p className="text-xs text-gray-400 mt-2">
            Submitted {new Date(result.submitted_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Per-question breakdown */}
      <h2 className="font-bold text-gray-800 mb-4 text-lg">Answer Breakdown</h2>
      <ol className="space-y-4">
        {(result.answers || []).map((a, i) => {
          const isMcq = a.question_type === "mcq";
          const isCorrect = a.is_correct;
          const isPending = !isMcq;

          return (
            <li key={a.question_id || i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {isMcq ? (
                    isCorrect
                      ? <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      : <XCircleIcon className="h-5 w-5 text-red-400" />
                  ) : (
                    <QuestionMarkCircleIcon className="h-5 w-5 text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
                    Q{i + 1} · {(a.question_type || "").replace("_", " ")} · {a.marks || 1} mark{(a.marks || 1) > 1 ? "s" : ""}
                  </p>
                  <p className="text-gray-800 font-medium mb-3 whitespace-pre-wrap">{a.question_text}</p>

                  <div className="space-y-1.5">
                    <div className="text-sm">
                      <span className="text-gray-400 text-xs uppercase tracking-wide font-semibold mr-2">Your answer:</span>
                      <span className={`font-medium ${isMcq ? (isCorrect ? "text-green-700" : "text-red-600") : "text-gray-700"}`}>
                        {a.answer_text || <em className="text-gray-400 font-normal">No answer</em>}
                      </span>
                    </div>
                    {isMcq && !isCorrect && a.correct_answer && (
                      <div className="text-sm">
                        <span className="text-gray-400 text-xs uppercase tracking-wide font-semibold mr-2">Correct:</span>
                        <span className="text-green-700 font-medium">{a.correct_answer}</span>
                      </div>
                    )}
                    {isPending && (
                      <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md inline-block mt-1">
                        Pending teacher review
                      </p>
                    )}
                  </div>

                  <div className="mt-2 text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isPending ? "bg-amber-50 text-amber-600" :
                      isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}>
                      {isPending ? `${a.marks_awarded ?? 0}/${a.marks} marks (pending)` :
                       isCorrect ? `+${a.marks_awarded ?? a.marks}` : "0"}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
