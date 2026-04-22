import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import quizService from "../../services/quizService";
import QuizInterface from "../../components/student/QuizInterface";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import { QUIZ_CONFIG } from "../../utils/constants";
import toast from "react-hot-toast";

export default function QuizPage() {
  const { instanceId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id || !instanceId) return;

    const init = async () => {
      try {
        // Load quiz instance
        const instanceRes = await quizService.getInstance(instanceId);
        setQuiz(instanceRes.data.quiz);
        setQuestions(instanceRes.data.questions);

        // Check attempt count
        const countRes = await quizService.getAttemptCount(user.id, instanceId);
        const count = countRes.data?.count || 0;
        setAttemptCount(count);

        if (count >= QUIZ_CONFIG.MAX_ATTEMPTS) {
          setError(
            `You've reached the maximum of ${QUIZ_CONFIG.MAX_ATTEMPTS} attempts for this quiz.`,
          );
          setLoading(false);
          return;
        }

        // Start attempt
        const attemptRes = await quizService.startAttempt(user.id, instanceId);
        setAttemptId(attemptRes.data.attempt_id);
      } catch {
        setError("Failed to load quiz. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [instanceId, user?.id]);

  const handleSubmit = async (answers) => {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      await quizService.submitAttempt(user.id, instanceId, answers);
      toast.success("Quiz submitted!");
      navigate(`/student/quiz/${attemptId}/results`, { replace: true });
    } catch {
      toast.error("Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (error) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Alert type="error" message={error} />
        <button
          className="mt-4 text-sm text-blue-600 underline"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <QuizInterface
      quiz={quiz}
      questions={questions}
      onSubmit={handleSubmit}
      submitting={submitting}
    />
  );
}
