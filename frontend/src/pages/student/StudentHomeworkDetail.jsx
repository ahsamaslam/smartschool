import { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import homeworkService from "../../services/homeworkService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import { IntegrityTracker } from "../../utils/IntegrityTracker";

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
  const [savingProgress, setSavingProgress] = useState(false);

  // Integrity tracking
  const trackersRef = useRef({});
  const textareaRefsRef = useRef({});

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

  // Initialize integrity tracking for text questions
  useEffect(() => {
    if (!payload?.questions) return;

    payload.questions.forEach((q) => {
      const isMcq = (q.question_type || "text") === "mcq";
      if (!isMcq && !trackersRef.current[q.id]) {
        // Create a tracker for this question
        trackersRef.current[q.id] = new IntegrityTracker(
          payload.submission?.id || `temp-${homeworkId}`,
          q.id,
          textareaRefsRef.current[q.id]
        );
      }
    });

    // Start tracking after refs are attached (small delay)
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
  }, [payload?.questions, payload?.submission?.id, homeworkId]);

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
  const submittedLock =
    sub && ["submitted", "late", "reviewed"].includes(sub.submission_status);
  const now = Date.now();
  const dueTime = hw.due_at ? new Date(hw.due_at).getTime() : null;
  const pastDue = dueTime != null && now > dueTime;
  const allowLate = Boolean(hw.allow_late_submission);
  const isReturned = sub?.submission_status === "returned";
  const st = sub?.submission_status || "pending";
  const deadlineHard =
    pastDue &&
    !allowLate &&
    !isReturned &&
    (!sub || ["pending", "in_progress"].includes(st));
  const editable = !submittedLock && !deadlineHard;

  const handleSaveProgress = async () => {
    if (hw.homework_type !== "interactive") return;
    const list = (payload.questions || []).map((q) => ({
      homework_question_id: q.id,
      answer_text: answers[q.id] || "",
    }));
    setSavingProgress(true);
    try {
      await homeworkService.saveProgress(hw.id, list);
      toast.success("Progress saved");
      load();
    } catch (e) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Could not save progress");
    } finally {
      setSavingProgress(false);
    }
  };

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

      // Collect integrity reports before submitting
      const integrityReports = Object.entries(trackersRef.current)
        .filter(([_, tracker]) => tracker && tracker.answerElement)
        .map(([qId, tracker]) => tracker.getReport());

      // Send submission with integrity data
      await homeworkService.submitInteractive(hw.id, list);

      // Send integrity reports separately to backend
      if (integrityReports.length > 0) {
        try {
          await fetch(
            `${(import.meta.env.VITE_API_URL || "http://localhost:8000/api")}/homework/submissions/integrity`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                homework_id: hw.id,
                reports: integrityReports,
              }),
            }
          );
        } catch (err) {
          console.warn("Could not submit integrity data:", err);
          // Don't fail submission if integrity reporting fails
        }
      }

      toast.success("Submitted");
      load();
    } catch (e) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Submit failed");
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
    } catch (e) {
      const d = e?.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Upload failed");
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
          <span>Subject: {hw.subject_name || "—"}</span>
          <span>Book: {hw.book_title || "—"}</span>
          <span>Topic: {hw.topic_title || "—"}</span>
          <span>Teacher: {hw.teacher_name || "—"}</span>
          {hw.due_at && (
            <span>
              Due: {new Date(hw.due_at).toLocaleString()}
              {allowLate ? " · Late submission allowed" : ""}
            </span>
          )}
          {hw.total_marks != null && <span>Total marks: {hw.total_marks}</span>}
        </div>
        {sub && (
          <p className="mt-3 text-sm">
            Status:{" "}
            <strong className="text-gray-900">{sub.submission_status}</strong>
            {sub.is_late ? " · Late" : ""}
          </p>
        )}
        {submittedLock && (
          <p className="mt-3 text-sm text-gray-600">
            This homework is submitted or graded — answers and files are locked.
          </p>
        )}
        {deadlineHard && !submittedLock && (
          <Alert
            type="warning"
            className="mt-3"
            message="Submission deadline has passed. You can no longer save drafts or submit unless your teacher allows late submission or returns the work for correction."
          />
        )}
        {sub?.teacher_feedback && (
          <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase">Teacher feedback</p>
            <p className="mt-1 text-gray-800 whitespace-pre-wrap">{sub.teacher_feedback}</p>
          </div>
        )}
      </div>

      {hw.homework_type === "interactive" && !(payload.questions || []).length && (
        <Alert
          type="warning"
          className="mb-6"
          message="There are no questions on this homework yet. Your teacher may still be editing it. Check back later, or ask them to add questions in the homework editor and publish. You should still see the title and any instructions above."
        />
      )}

      {hw.homework_type === "interactive" && (payload.questions || []).length > 0 && (
        <>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Your questions</h2>
          <p className="text-sm text-gray-600 mb-4">
            Type your answers or select options, then use <strong>Save progress</strong> or <strong>Submit all answers</strong>.
          </p>
        </>
      )}

      {hw.homework_type === "interactive" && (payload.questions || []).length > 0 && (
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
                        disabled={!editable}
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
                ref={(el) => {
                  if (el) {
                    textareaRefsRef.current[q.id] = el;
                    // Reinitialize tracker if refs changed
                    if (!trackersRef.current[q.id]) {
                      trackersRef.current[q.id] = new IntegrityTracker(
                        payload.submission?.id || `temp-${homeworkId}`,
                        q.id,
                        el
                      );
                      trackersRef.current[q.id].startTracking();
                    }
                  }
                }}
                required={editable && !isMcq}
                disabled={!editable}
                value={answers[q.id] || ""}
                onChange={(e) => {
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                rows={4}
                className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none overflow-hidden"
                placeholder="Write your answer here…"
                style={{ minHeight: "100px" }}
              />
              )}
            </div>
            );
          })}
          {editable && (
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="secondary" loading={savingProgress} onClick={handleSaveProgress}>
                Save progress
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                Submit all answers
              </Button>
            </div>
          )}
        </form>
      )}

      {hw.homework_type === "upload" && (
        <form onSubmit={handleSubmitUpload} className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Your submission</h2>
          <p className="text-sm text-gray-600 mb-2">
            Follow the instructions above, choose file(s), then <strong>Submit files</strong>.
          </p>
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
          {editable && (
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
