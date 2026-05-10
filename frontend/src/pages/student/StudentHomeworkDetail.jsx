import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import homeworkService from "../../services/homeworkService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(
  "/api",
  "",
);

export default function StudentHomeworkDetail() {
  const { homeworkId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    homeworkService
      .studentGet(homeworkId)
      .then((res) => {
        setPayload(res.data);
        const map = {};
        (res.data?.answers || []).forEach((a) => {
          map[a.homework_question_id] = a.answer_text || "";
        });
        setAnswers(map);
      })
      .catch(() => setError("Homework not found or not assigned to your class."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [homeworkId]);

  if (loading) return <PageSpinner />;
  if (error || !payload?.homework) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Alert type="error" message={error || "Unavailable"} />
        <Link to="/student/homework" className="text-indigo-600 text-sm mt-4 inline-block">
          ← Back
        </Link>
      </div>
    );
  }

  const hw = payload.homework;
  const sub = payload.submission;
  const locked =
    sub &&
    ["submitted", "late", "reviewed", "returned"].includes(sub.submission_status);

  const handleSubmitInteractive = async (e) => {
    e.preventDefault();
    for (const q of payload.questions || []) {
      if ((q.question_type || "text") === "mcq") {
        const opts = parseOptionsJson(q.options_json);
        if (opts.length > 0) {
          const v = answers[q.id];
          if (v === undefined || v === "") {
            toast.error("Select an option for each multiple-choice question.");
            return;
          }
        }
      }
    }
    setSubmitting(true);
    try {
      const list = (payload.questions || []).map((q) => ({
        homework_question_id: q.id,
        answer_text: answers[q.id] || "",
      }));
      await homeworkService.submitInteractive(hw.id, list);
      toast.success("Submitted");
      load();
    } catch {
      toast.error("Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitUpload = async (e) => {
    e.preventDefault();
    if (!files.length) {
      toast.error("Choose at least one file");
      return;
    }
    setSubmitting(true);
    try {
      await homeworkService.submitUpload(hw.id, files);
      toast.success("Files uploaded");
      setFiles([]);
      load();
    } catch {
      toast.error("Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadList = sub?.upload_files_json;
  const uploads = Array.isArray(uploadList)
    ? uploadList
    : typeof uploadList === "string"
      ? JSON.parse(uploadList || "[]")
      : [];

  return (
    <div className="p-6 max-w-3xl mx-auto pb-20">
      <Link to="/student/homework" className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-block">
        ← My Homework
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mb-8">
        <p className="text-xs font-bold uppercase text-teal-700 tracking-wide">
          {hw.homework_type === "interactive" ? "Interactive" : "Upload"}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{hw.title}</h1>
        {hw.instructions && (
          <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{hw.instructions}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
          <span>Topic: {hw.topic_title || "—"}</span>
          {hw.due_at && <span>Due: {new Date(hw.due_at).toLocaleString()}</span>}
          {hw.total_marks != null && <span>Total marks: {hw.total_marks}</span>}
        </div>
        {sub && (
          <p className="mt-3 text-sm">
            Status:{" "}
            <strong className="text-gray-900">{sub.submission_status}</strong>
            {sub.is_late ? " · Late" : ""}
          </p>
        )}
        {sub?.teacher_feedback && (
          <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Teacher feedback</p>
            <p className="mt-1 text-gray-800 whitespace-pre-wrap">{sub.teacher_feedback}</p>
          </div>
        )}
      </div>

      {hw.homework_type === "interactive" && (
        <form onSubmit={handleSubmitInteractive} className="space-y-6">
          {(payload.questions || []).map((q) => {
            const isMcq = (q.question_type || "text") === "mcq";
            const opts = parseOptionsJson(q.options_json);
            return (
            <div key={q.id} className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-semibold text-gray-900">{q.question_text}</p>
              <p className="text-xs text-gray-400 mt-1">Marks: {q.marks}</p>
              {isMcq && opts.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {opts.map((label, oi) => (
                    <label
                      key={oi}
                      className={`flex items-start gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${
                        String(answers[q.id]) === String(oi)
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-gray-100 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`hq-${q.id}`}
                        disabled={locked}
                        checked={String(answers[q.id]) === String(oi)}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: String(oi) }))
                        }
                        className="mt-1"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              ) : (
              <textarea
                required={!locked && !isMcq}
                disabled={locked}
                value={answers[q.id] || ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                className="mt-3 w-full min-h-[100px] rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="Your answer"
              />
              )}
            </div>
            );
          })}
          {!locked && (
            <Button type="submit" variant="primary" loading={submitting}>
              Submit all answers
            </Button>
          )}
        </form>
      )}

      {hw.homework_type === "upload" && (
        <form onSubmit={handleSubmitUpload} className="space-y-4">
          {hw.allowed_file_extensions && (
            <p className="text-xs text-gray-500">
              Allowed types: {hw.allowed_file_extensions}
            </p>
          )}
          {uploads.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Uploaded</p>
              <ul className="space-y-2">
                {uploads.map((u, i) => (
                  <li key={i}>
                    <a
                      href={`${API_BASE}${u.path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      {u.original_name || u.path}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!locked && (
            <>
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="text-sm"
              />
              <div>
                <Button type="submit" variant="primary" loading={submitting}>
                  Submit files
                </Button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}

function parseOptionsJson(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}
