import { useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import learningService from "../../services/learningService";
import examService from "../../services/examService";
import { PageSpinner } from "../../components/common/Spinner";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { IntegrityTracker } from "../../utils/IntegrityTracker";
import Button from "../../components/common/Button";

export default function StudentExamTake() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [files, setFiles] = useState([]);
  const [submissionMode, setSubmissionMode] = useState("interactive"); // "interactive" or "upload"
  const [submitting, setSubmitting] = useState(false);

  // Integrity tracking
  const trackersRef = useRef({});
  const textareaRefsRef = useRef({});
  const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(
    "/api",
    "",
  );

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

  // Initialize integrity tracking for text questions
  useEffect(() => {
    if (!started || !exam?.questions) return;

    exam.questions.forEach((q) => {
      const isTextQuestion = q.question_type && q.question_type !== "mcq";
      if (isTextQuestion && !trackersRef.current[q.id]) {
        trackersRef.current[q.id] = new IntegrityTracker(
          `exam-${examId}`,
          q.id,
          textareaRefsRef.current[q.id]
        );
      }
    });

    // Start tracking after refs are attached
    const startTracking = setTimeout(() => {
      Object.values(trackersRef.current).forEach((tracker) => {
        if (tracker && tracker.answerElement) {
          tracker.startTracking();
        }
      });
    }, 100);

    return () => {
      clearTimeout(startTracking);
      Object.values(trackersRef.current).forEach((tracker) => {
        tracker?.stopTracking();
      });
    };
  }, [started, exam?.questions, examId]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitInteractive = async () => {
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

      // Collect integrity reports before finishing
      const integrityReports = Object.entries(trackersRef.current)
        .filter(([_, tracker]) => tracker && tracker.answerElement)
        .map(([qId, tracker]) => tracker.getReport());

      // Send integrity reports separately to backend
      if (integrityReports.length > 0) {
        try {
          await fetch(
            `${(import.meta.env.VITE_API_URL || "http://localhost:8000/api")}/exams/submissions/integrity`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                exam_id: examId,
                reports: integrityReports,
              }),
            }
          );
        } catch (err) {
          console.warn("Could not submit exam integrity data:", err);
        }
      }

      toast.success("Exam submitted!");
      navigate(`/student/exam/${examId}/results`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitUpload = async () => {
    if (!files.length) {
      toast.error("Choose at least one file");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch(
        `${(import.meta.env.VITE_API_URL || "http://localhost:8000/api")}/exams/${examId}/submit-files`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      toast.success("Files submitted!");
      navigate(`/student/exam/${examId}/results`);
    } catch (err) {
      toast.error(err?.message || "Submit failed.");
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
            You can submit this exam as interactive answers (with integrity tracking) or upload files. Choose your method below.
          </p>
          <div className="flex gap-3 justify-center mb-6">
            <button
              onClick={() => { setSubmissionMode("interactive"); handleStart(); }}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Interactive Answers
            </button>
            <button
              onClick={() => { setSubmissionMode("upload"); handleStart(); }}
              className="px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
            >
              Upload Files
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Submission Mode Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              onClick={() => setSubmissionMode("interactive")}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                submissionMode === "interactive"
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Interactive Answers
            </button>
            <button
              onClick={() => setSubmissionMode("upload")}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                submissionMode === "upload"
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Upload Files
            </button>
          </div>

          {submissionMode === "interactive" && (
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
                        ref={(el) => {
                          if (el) {
                            textareaRefsRef.current[q.id] = el;
                            if (!trackersRef.current[q.id] && started) {
                              trackersRef.current[q.id] = new IntegrityTracker(
                                `exam-${examId}`,
                                q.id,
                                el
                              );
                              trackersRef.current[q.id].startTracking();
                            }
                          }
                        }}
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

              {/* Submit Interactive */}
              <button
                onClick={handleSubmitInteractive}
                disabled={submitting}
                className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors text-base"
              >
                {submitting ? "Submitting…" : "Submit Answers"}
              </button>
            </>
          )}

          {submissionMode === "upload" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Submit Your Exam</h2>
              <p className="text-sm text-gray-600">
                Upload your exam file(s) below. You can answer this exam using your preferred method and submit the files.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-900">
                  <strong>Integrity Note:</strong> File submissions are tracked. Make sure to follow academic integrity guidelines.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Choose files to upload
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                    disabled={submitting}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>

                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Selected files ({files.length}):</p>
                    <ul className="space-y-1">
                      {files.map((file, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                          {file.name} ({(file.size / 1024).toFixed(2)} KB)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleSubmitUpload}
                    disabled={submitting || files.length === 0}
                    className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Submitting…" : "Submit Files"}
                  </button>
                  <button
                    onClick={() => setFiles([])}
                    disabled={submitting}
                    className="px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 disabled:opacity-60 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
