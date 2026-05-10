import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import homeworkService from "../../services/homeworkService";
import { PageSpinner } from "../../components/common/Spinner";
import Button from "../../components/common/Button";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(
  "/api",
  "",
);

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

export default function TeacherHomeworkSubmissions() {
  const { classId, homeworkId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      homeworkService.teacherGet(homeworkId),
      homeworkService.teacherSubmissions(homeworkId),
    ])
      .then(([detail, subs]) => {
        setMeta(detail.data);
        setRows(subs.data?.data || []);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [homeworkId]);

  const grade = async (submissionId, payload) => {
    try {
      await homeworkService.gradeSubmission(submissionId, payload);
      toast.success("Saved");
      load();
    } catch {
      toast.error("Could not save grade");
    }
  };

  if (loading) return <PageSpinner />;

  const hw = meta?.data;

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <button
        type="button"
        onClick={() => navigate(`/teacher/classes/${classId}/homework`)}
        className="text-sm text-gray-500 mb-4"
      >
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Submissions</h1>
      {hw && (
        <p className="text-sm text-gray-500 mb-8">
          {hw.title} · {hw.homework_type}
        </p>
      )}

      {!rows.length ? (
        <p className="text-gray-400 text-center py-12">No submissions yet.</p>
      ) : (
        <div className="space-y-10">
          {rows.map((sub) => (
            <SubmissionCard
              key={sub.id}
              sub={sub}
              homeworkType={hw?.homework_type}
              onGrade={grade}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({ sub, homeworkType, onGrade }) {
  const [feedback, setFeedback] = useState(sub.teacher_feedback || "");
  const [marks, setMarks] = useState(
    sub.marks_awarded != null ? String(sub.marks_awarded) : "",
  );
  const [perQ, setPerQ] = useState(() => {
    const m = {};
    (sub.answers || []).forEach((a) => {
      m[a.homework_question_id] = {
        marks: a.marks_awarded != null ? String(a.marks_awarded) : "",
        comment: a.teacher_comment || "",
      };
    });
    return m;
  });

  const files = Array.isArray(sub.upload_files_json)
    ? sub.upload_files_json
    : typeof sub.upload_files_json === "string"
      ? JSON.parse(sub.upload_files_json || "[]")
      : [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap justify-between gap-2 mb-4">
        <div>
          <p className="font-semibold text-gray-900">{sub.full_name}</p>
          <p className="text-xs text-gray-500">{sub.email}</p>
        </div>
        <span className="text-xs font-bold uppercase text-gray-500">{sub.submission_status}</span>
      </div>

      {homeworkType === "upload" && files.length > 0 && (
        <ul className="mb-4 space-y-1">
          {files.map((u, i) => (
            <li key={i}>
              <a
                href={`${API_BASE}${u.path}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-indigo-600 hover:underline"
              >
                {u.original_name || "File"}
              </a>
            </li>
          ))}
        </ul>
      )}

      {(sub.answers || []).map((a) => {
        const opts = parseOptionsJson(a.options_json);
        let idx = -1;
        try {
          idx = parseInt(String(a.answer_text || "").trim(), 10);
        } catch {
          idx = -1;
        }
        const picked = idx >= 0 && idx < opts.length ? opts[idx] : null;
        const correctIdx =
          a.correct_option_index != null ? Number(a.correct_option_index) : null;
        const correctLabel =
          correctIdx != null && correctIdx >= 0 && correctIdx < opts.length
            ? opts[correctIdx]
            : null;
        const mcqOk =
          a.question_type === "mcq" &&
          correctIdx != null &&
          idx === correctIdx;
        return (
        <div key={a.homework_question_id} className="mb-4 rounded-xl bg-gray-50 p-4 text-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Question</p>
          <p className="text-gray-800 mt-1">{a.question_text}</p>
          <p className="text-xs text-gray-500 mt-2">Student answer</p>
          {a.question_type === "mcq" && opts.length > 0 ? (
            <div className="mt-1">
              <p className="text-gray-900">
                {picked || a.answer_text || "—"}
                {mcqOk ? (
                  <span className="ml-2 text-emerald-600 font-semibold">Auto-marked correct</span>
                ) : picked ? (
                  <span className="ml-2 text-amber-600 font-semibold">Auto-marked incorrect</span>
                ) : null}
              </p>
              {correctLabel ? (
                <p className="text-xs text-gray-600 mt-1">Correct option: {correctLabel}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-gray-900 whitespace-pre-wrap mt-1">{a.answer_text || "—"}</p>
          )}
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            <input
              type="number"
              placeholder="Marks"
              value={perQ[a.homework_question_id]?.marks ?? ""}
              onChange={(e) =>
                setPerQ((p) => ({
                  ...p,
                  [a.homework_question_id]: {
                    ...p[a.homework_question_id],
                    marks: e.target.value,
                  },
                }))
              }
              className="rounded-lg border border-gray-200 px-2 py-1 text-sm"
            />
            <input
              placeholder="Comment"
              value={perQ[a.homework_question_id]?.comment ?? ""}
              onChange={(e) =>
                setPerQ((p) => ({
                  ...p,
                  [a.homework_question_id]: {
                    ...p[a.homework_question_id],
                    comment: e.target.value,
                  },
                }))
              }
              className="rounded-lg border border-gray-200 px-2 py-1 text-sm"
            />
          </div>
        </div>
        );
      })}

      <div className="space-y-2 mt-4">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Overall feedback"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm min-h-[72px]"
        />
        <div className="flex flex-wrap gap-3 items-end">
          <input
            type="number"
            placeholder="Total marks awarded"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm w-48"
          />
          <Button
            variant="primary"
            onClick={() =>
              onGrade(sub.id, {
                teacher_feedback: feedback || null,
                marks_awarded: marks ? Number(marks) : null,
                submission_status: "reviewed",
                answers: (sub.answers || []).map((a) => ({
                  homework_question_id: a.homework_question_id,
                  marks_awarded: perQ[a.homework_question_id]?.marks
                    ? Number(perQ[a.homework_question_id].marks)
                    : null,
                  teacher_comment: perQ[a.homework_question_id]?.comment || null,
                })),
              })
            }
          >
            Save review
          </Button>
        </div>
      </div>
    </div>
  );
}
