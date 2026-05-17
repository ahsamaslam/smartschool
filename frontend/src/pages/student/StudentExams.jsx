import { useEffect, useState } from "react";
import examService from "../../services/examService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (!timeStr) return date;
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${date} · ${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function ExamCard({ exam, highlight }) {
  const dateTime = formatDateTime(exam.exam_date, exam.exam_time);
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        highlight
          ? "border-indigo-400 bg-indigo-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <p className="font-semibold text-gray-900">{exam.title}</p>
      <p className="text-xs text-gray-500 mt-1">
        {exam.subject_name} · {exam.class_name}
      </p>
      {exam.teacher_name && (
        <p className="text-xs text-gray-400 mt-0.5">Teacher: {exam.teacher_name}</p>
      )}
      {dateTime && (
        <p className={`text-xs mt-2 font-medium ${highlight ? "text-indigo-700" : "text-gray-600"}`}>
          {dateTime}
        </p>
      )}
    </div>
  );
}

function Section({ title, description, exams, empty, highlight }) {
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
            <ExamCard key={e.id} exam={e} highlight={highlight} />
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
    examService
      .getMyScheduledExams()
      .then((res) => setData(res.data))
      .catch(() => setError("Could not load exam schedule."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Exams</h1>
      <p className="text-sm text-gray-500 mb-8">
        Scheduled exams from your teachers. Exams are physical — attend in class on the date and time shown.
      </p>

      {error && <Alert type="error" message={error} className="mb-6" />}

      <Section
        title="Today"
        description="Exams scheduled for today."
        exams={data?.today}
        empty="No exams scheduled for today."
        highlight
      />
      <Section
        title="Upcoming"
        description="Future scheduled exams."
        exams={data?.upcoming}
        empty="No upcoming exams."
      />
      <Section
        title="Past"
        description="Exams that have already taken place."
        exams={data?.past}
        empty="No past exams."
      />
    </div>
  );
}
