import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import learningService from "../../services/learningService";
import { PageSpinner } from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function StudentExamTake() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [started, setStarted] = useState(false);

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
    return () => {
      cancel = true;
    };
  }, [examId, navigate]);

  const handleStart = async () => {
    try {
      await learningService.startExam(examId);
      setStarted(true);
      toast.success("Exam started — good luck!");
    } catch {
      toast.error("Could not start exam.");
    }
  };

  const handleSubmit = async () => {
    try {
      await learningService.submitExam(examId);
      toast.success("Submitted (grading may be added later).");
      navigate("/student/exams");
    } catch {
      toast.error("Submit failed.");
    }
  };

  if (loading) return <PageSpinner />;

  if (!exam) return null;

  const questions = exam.questions || [];

  return (
    <div className="p-6 max-w-3xl mx-auto pb-24">
      <Link
        to="/student/exams"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to exams
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{exam.title}</h1>
      <p className="text-sm text-gray-500 mb-2">
        {exam.subject_name} · {exam.class_name}
      </p>
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-8">
        This is a practice view: correct answers are hidden. Full online grading can be
        connected later.
      </p>

      {!started ? (
        <Button variant="primary" onClick={handleStart}>
          Start exam
        </Button>
      ) : (
        <>
          <ol className="space-y-8 mb-10">
            {questions.map((q, i) => (
              <li
                key={q.id || i}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold text-gray-400 mb-2">
                  Question {i + 1} · {q.question_type || "question"} · {q.marks || 1}{" "}
                  marks
                </p>
                <p className="text-gray-900 whitespace-pre-wrap">{q.question_text}</p>
                {q.options && typeof q.options === "object" && (
                  <ul className="mt-3 space-y-2">
                    {Object.entries(q.options).map(([k, v]) => (
                      <li key={k} className="text-sm text-gray-700 pl-3 border-l-2 border-gray-100">
                        <strong>{k}.</strong> {v}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          <Button variant="primary" onClick={handleSubmit}>
            Submit exam
          </Button>
        </>
      )}
    </div>
  );
}
