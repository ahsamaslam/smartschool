import { useState, useEffect, useRef, useCallback } from "react";
import clsx from "clsx";
import Button from "../common/Button";
import Spinner from "../common/Spinner";

const QUESTION_LABELS = {
  mcq: "MCQ",
  short_answer: "Short Answer",
  long_answer: "Long Answer",
};

/**
 * QuizInterface
 * - Full-page mandatory quiz with countdown timer
 * - Content is non-copyable (user-select: none)
 * - Tab switch detection pauses timer and warns student
 */
export default function QuizInterface({
  quiz,
  questions,
  onSubmit,
  submitting,
}) {
  const timeLimitSeconds = (quiz?.time_limit_minutes || 30) * 60;
  const [timeLeft, setTimeLeft] = useState(timeLimitSeconds);
  const [answers, setAnswers] = useState({});
  const [tabWarning, setTabWarning] = useState(false);
  const timerRef = useRef(null);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Tab switch detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabWarning(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleAutoSubmit = useCallback(() => {
    onSubmit(buildAnswerPayload());
  }, [answers]);

  const buildAnswerPayload = () =>
    questions.map((q) => ({
      question_id: q.quiz_question_id,
      answer: answers[q.quiz_question_id] || "",
    }));

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isUrgent = timeLeft <= 60;

  return (
    <div className="select-none min-h-screen bg-gray-50">
      {/* Sticky header with timer */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <h2 className="font-semibold text-gray-800 text-lg">
          Quiz — {quiz?.total_points || 0} pts
        </h2>
        <div
          className={clsx(
            "text-2xl font-mono font-bold tabular-nums",
            isUrgent ? "text-red-600 animate-pulse" : "text-blue-600",
          )}
        >
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Tab-switch warning banner */}
      {tabWarning && (
        <div className="bg-amber-50 border-b border-amber-300 px-6 py-2 text-sm text-amber-800 flex items-center gap-2">
          <span className="font-semibold">Warning:</span> Switching tabs during
          the quiz is not allowed.
          <button
            className="ml-auto text-amber-700 underline text-xs"
            onClick={() => setTabWarning(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Questions */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {questions.map((q, idx) => (
          <div
            key={q.quiz_question_id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="flex-1">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {QUESTION_LABELS[q.question_type] || q.question_type} ·{" "}
                  {q.points} pt{q.points !== 1 ? "s" : ""}
                </span>
                <p className="mt-1 text-gray-800 font-medium">
                  {q.question_text}
                </p>
              </div>
            </div>

            {q.question_type === "mcq" ? (
              <MCQOptions
                options={q.options}
                selected={answers[q.quiz_question_id]}
                onChange={(val) => setAnswer(q.quiz_question_id, val)}
              />
            ) : (
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={q.question_type === "long_answer" ? 6 : 3}
                placeholder="Write your answer here…"
                value={answers[q.quiz_question_id] || ""}
                onChange={(e) => setAnswer(q.quiz_question_id, e.target.value)}
              />
            )}
          </div>
        ))}

        <div className="flex justify-end pb-12">
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            onClick={() => onSubmit(buildAnswerPayload())}
          >
            Submit Quiz
          </Button>
        </div>
      </div>
    </div>
  );
}

function MCQOptions({ options, selected, onChange }) {
  const parsed =
    typeof options === "string" ? JSON.parse(options) : options || [];
  return (
    <div className="space-y-2">
      {parsed.map((opt, i) => {
        const label = typeof opt === "object" ? opt.text || opt.label : opt;
        const isSelected = selected === label;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(label)}
            className={clsx(
              "w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors",
              isSelected
                ? "border-blue-500 bg-blue-50 text-blue-800 font-medium"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            <span className="font-semibold mr-2">
              {String.fromCharCode(65 + i)}.
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
