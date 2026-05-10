import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import learningService from "../../services/learningService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";

function ExamCard({ exam }) {
  return (
    <Link
      to={`/student/exams/${exam.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-200 transition-colors"
    >
      <p className="font-semibold text-gray-900">{exam.title}</p>
      <p className="text-xs text-gray-500 mt-1">{exam.subject_name} · {exam.class_name}</p>
      {exam.due_at && (
        <p className="text-xs text-amber-700 mt-2">
          Due {new Date(exam.due_at).toLocaleString()}
        </p>
      )}
    </Link>
  );
}

function Section({ title, description, exams, empty }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      {!exams?.length ? (
        <p className="text-sm text-gray-400 py-6 text-center border border-dashed rounded-xl">
          {empty}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {exams.map((e) => (
            <ExamCard key={e.id} exam={e} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function StudentExams() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    learningService
      .getGroupedExams()
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load exams."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Exams</h1>
      <p className="text-sm text-gray-500 mb-8">
        Exams from teachers for your enrolled sections. Open an exam to review questions
        (answers are hidden until grading is enabled).
      </p>

      {error && <Alert type="error" message={error} className="mb-6" />}

      <Section
        title="Active"
        description="You have started these exams."
        exams={data?.active}
        empty="No active exams."
      />
      <Section
        title="Upcoming"
        description="Available to start when you are ready."
        exams={data?.upcoming}
        empty="No upcoming exams."
      />
      <Section
        title="Missed"
        description="Past due date and not submitted (if your teacher set a due date)."
        exams={data?.missed}
        empty="No missed exams."
      />
      <Section
        title="Completed"
        description="Submitted attempts."
        exams={data?.completed}
        empty="No completed exams yet."
      />
    </div>
  );
}
