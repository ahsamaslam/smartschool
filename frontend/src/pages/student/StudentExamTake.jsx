import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import learningService from "../../services/learningService";
import examService from "../../services/examService";
import { PageSpinner } from "../../components/common/Spinner";
import { ArrowLeftIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

export default function StudentExamTake() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await learningService.getStudentExam(examId);
        if (!cancel) setExam(res.data);
      } catch {
        if (!cancel) {
          toast.error("Exam not available.");
          navigate("/student/exams", { replace: true });
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [examId, navigate]);

  const handleStart = async () => {
    try {
      await learningService.startExam(examId);
      setStarted(true);
    } catch {
      toast.error("Could not start exam.");
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    const questions = exam?.questions || [];
    const unanswered = questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      const ok = window.confirm(
        `You have ${unanswered.length} unanswered question${unanswered.length > 1 ? "s" : ""}. Submit anyway?`
      );
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const payload = Object.entries(answers)
        .filter(([, v]) => v?.trim())
        .map(([question_id, answer_text]) => ({ question_id, answer_text }));

      await examService.submitExam(examId, payload);
      toast.success("Exam submitted!");
      navigate(`/student/exam/${examId}/results`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (!exam) return null;

  const questions = exam.questions || [];
  const answered = Object.values(answers).filter((v) => v?.trim()).length;

  return (
    <div className="p-6 max-w-3xl mx-auto pb-24">
      <Link to="/student/exams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to exams
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{exam.title}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {exam.subject_name} · {exam.class_name} · {questions.length} question{questions.length !== 1 ? "s" : ""}
      </p>

      {!started ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">Ready to begin?</h2>
          <p className="text-sm text-gray-500 mb-6">
            Answer all questions and click Submit when done. MCQ answers are auto-graded.
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Start Exam
          </button>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-6 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {answered} / {questions.length} answered
            </span>
            <div className="w-48 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-indigo-500 rounded-full transition-all"
                style={{ width: `${questions.length > 0 ? (answered / questions.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Questions */}
          <ol className="space-y-6 mb-10">
            {questions.map((q, i) => (
              <li key={q.id || i} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                  Q{i + 1} · {(q.question_type || "question").replace("_", " ")} · {q.marks || 1} mark{(q.marks || 1) > 1 ? "s" : ""}
                </p>
                <p className="text-gray-900 font-medium mb-4 whitespace-pre-wrap">{q.question_text}</p>

                {q.question_type === "mcq" && q.options && typeof q.options === "object" ? (
                  <div className="space-y-2">
                    {Object.entries(q.options).map(([k, v]) => (
                      <label
                        key={k}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                          answers[q.id] === k
                            ? "border-indigo-400 bg-indigo-50"
                            : "border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={k}
                          checked={answers[q.id] === k}
                          onChange={() => handleAnswerChange(q.id, k)}
                          className="accent-indigo-600"
                        />
                        <span className="text-sm text-gray-800">
                          <strong className="text-indigo-600">{k}.</strong> {v}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    rows={q.question_type === "long_answer" ? 6 : 3}
                    value={answers[q.id] || ""}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    placeholder="Write your answer here…"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                )}
              </li>
            ))}
          </ol>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 text-base"
          >
            {submitting && <ArrowPathIcon className="h-5 w-5 animate-spin" />}
            {submitting ? "Submitting…" : "Submit Exam"}
          </button>
        </>
      )}
    </div>
  );
}
