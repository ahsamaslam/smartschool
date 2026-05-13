import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import homeworkService from "../../services/homeworkService";
import { PageSpinner } from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import IntegrityReportDashboard from "../../components/teacher/IntegrityReportDashboard";

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

function statusLabel(st) {
  const map = {
    missing: "Missing",
    pending: "Pending",
    in_progress: "In progress",
    submitted_awaiting: "Submitted",
    late_awaiting: "Late",
    reviewed: "Reviewed",
    returned: "Returned",
  };
  return map[st] || st || "—";
}

export default function TeacherHomeworkSubmissions() {
  const { user } = useAuth();
  const canEditHomework = user?.role === "teacher" || user?.role === "admin";
  const { classId, homeworkId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRows = rows.filter((sub) =>
    (sub.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (sub.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const load = () => {
    setLoading(true);
    Promise.all([
      homeworkService.teacherGet(homeworkId),
      homeworkService.teacherSubmissions(homeworkId),
    ])
      .then(([detail, subs]) => {
        setMeta(detail.data);
        setRows(subs.data?.data || []);
        setAnalytics(subs.data?.analytics || null);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [homeworkId]);

  const grade = async (submissionId, payload) => {
    if (!submissionId) return;
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
  const assignmentQuestions = Array.isArray(meta?.questions) ? meta.questions : [];

  return (
    <div className="p-6 max-w-5xl mx-auto pb-20">
      <button
        type="button"
        onClick={() => navigate(`/teacher/classes/${classId}/homework`)}
        className="text-sm text-gray-500 mb-4"
      >
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Homework submissions</h1>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Teacher / admin only</p>
      {hw && (
        <p className="text-sm text-gray-500 mb-4">
          {hw.title} · {hw.homework_type === "interactive" ? "Interactive" : "Upload"}
        </p>
      )}

      {hw && (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
                Published assignment (reference for grading)
              </h2>
              <p className="text-xs text-slate-700 mt-1 max-w-2xl">
                Read-only copy of instructions and questions. Students complete this on{" "}
                <strong>My Homework</strong> → open the task → use radio buttons / text boxes →{" "}
                <strong>Submit</strong> — not on this screen.
              </p>
            </div>
            {canEditHomework && (
              <Link
                to={`/teacher/classes/${classId}/homework/${homeworkId}/edit`}
                className="shrink-0 rounded-xl bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
              >
                Edit instructions &amp; questions
              </Link>
            )}
          </div>
          {hw.instructions ? (
            <div className="rounded-xl border border-white/80 bg-white/90 p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Instructions</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{hw.instructions}</p>
            </div>
          ) : (
            <p className="text-xs text-amber-800 mb-4">No instructions text — consider adding context in Edit.</p>
          )}
          {hw.homework_type === "interactive" && (
            <div className="rounded-xl border border-white/80 bg-white/90 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Questions ({assignmentQuestions.length})
              </p>
              {!assignmentQuestions.length ? (
                <p className="text-sm text-amber-800">
                  No questions are saved on this homework yet. Students will only see the title and instructions until
                  you add questions in the homework editor and publish again if needed.
                </p>
              ) : (
                <ol className="space-y-4 list-decimal list-inside text-sm text-gray-800">
                  {assignmentQuestions.map((q, i) => {
                    const opts = parseOptionsJson(q.options_json);
                    const isMcq = (q.question_type || "text") === "mcq";
                    return (
                      <li key={q.id || i} className="marker:font-semibold">
                        <span className="font-medium text-gray-900">{q.question_text}</span>
                        <span className="text-gray-500 text-xs ml-2">({q.marks != null ? q.marks : 1} marks)</span>
                        {isMcq && opts.length > 0 && (
                          <ul className="mt-2 ml-4 list-disc space-y-1 text-gray-700 text-sm">
                            {opts.map((label, oi) => (
                              <li key={oi}>{label}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
          {hw.homework_type === "upload" && (
            <p className="text-sm text-gray-700 rounded-xl border border-white/80 bg-white/90 p-4">
              <strong>Upload task:</strong> students read the instructions above and submit files (
              {hw.allowed_file_extensions || "types set in editor"}).
            </p>
          )}
        </section>
      )}

      {analytics && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold">Class size</p>
            <p className="text-2xl font-bold text-gray-900">{analytics.total_students}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold">Awaiting review</p>
            <p className="text-2xl font-bold text-blue-700">{analytics.awaiting_review}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold">Missing</p>
            <p className="text-2xl font-bold text-red-600">{analytics.missing}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 uppercase font-semibold">Avg score</p>
            <p className="text-2xl font-bold text-emerald-700">
              {analytics.average_marks_awarded != null ? analytics.average_marks_awarded : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Integrity Report Dashboard */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Academic Integrity Monitoring</h2>
        <p className="text-sm text-gray-600 mb-4">
          Automated tracking of paste events, typing patterns, and tab switches. Click on a student to review details.
        </p>
        <IntegrityReportDashboard homeworkId={homeworkId} />
      </div>

      {!rows.length ? (
        <p className="text-gray-400 text-center py-12">No students enrolled in this class.</p>
      ) : (
        <>
          {/* Submissions List */}
          <div className="mb-8">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-gray-700">All Submissions ({filteredRows.length})</h2>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
            {filteredRows.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                {searchQuery ? "No students match your search." : "No submissions."}
              </div>
            ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Student</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Submitted</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Marks</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRows.map((sub) => {
                    const st = sub.effective_status || sub.submission_status;
                    const isSelected = selectedSubmissionId === sub.id;
                    return (
                      <tr
                        key={sub.id || sub.student_id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{sub.full_name}</p>
                          <p className="text-xs text-gray-500">{sub.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {statusLabel(st)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {sub.submitted_at
                            ? new Date(sub.submitted_at).toLocaleDateString()
                            : "Not submitted"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {sub.marks_awarded != null ? (
                            <>
                              {sub.marks_awarded} {sub.total_marks ? `/ ${sub.total_marks}` : ""}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              setSelectedSubmissionId(isSelected ? null : sub.id)
                            }
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                          >
                            {isSelected ? "Collapse" : sub.id ? "Grade" : "View"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Selected Submission Detail for Grading */}
          {selectedSubmissionId && (
            <div className="border-t pt-8">
              {rows
                .filter((sub) => sub.id === selectedSubmissionId)
                .map((sub) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    homeworkType={hw?.homework_type}
                    onGrade={grade}
                  />
                ))}
            </div>
          )}
        </>
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

  const st = sub.effective_status || sub.submission_status;
  const canReturn = ["submitted_awaiting", "late_awaiting", "reviewed"].includes(st);
  const canReopen = st === "reviewed";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap justify-between gap-2 mb-4">
        <div>
          <p className="font-semibold text-gray-900">{sub.full_name}</p>
          <p className="text-xs text-gray-500">{sub.email}</p>
          {sub.submitted_at && (
            <p className="text-xs text-gray-400 mt-1">
              Submitted {new Date(sub.submitted_at).toLocaleString()}
            </p>
          )}
        </div>
        <span className="text-xs font-bold uppercase text-gray-600">{statusLabel(st)}</span>
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
        const correctIdx = a.correct_option_index != null ? Number(a.correct_option_index) : null;
        const correctLabel =
          correctIdx != null && correctIdx >= 0 && correctIdx < opts.length ? opts[correctIdx] : null;
        const mcqOk = a.question_type === "mcq" && correctIdx != null && idx === correctIdx;
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
            {st === "reviewed" ? "Update review" : "Save review"}
          </Button>
          {canReturn && (
            <Button
              variant="secondary"
              onClick={() =>
                onGrade(sub.id, {
                  teacher_feedback: feedback || null,
                  marks_awarded: marks ? Number(marks) : null,
                  submission_status: "returned",
                  answers: [],
                })
              }
            >
              Return for correction
            </Button>
          )}
          {canReopen && (
            <Button
              variant="secondary"
              onClick={() =>
                onGrade(sub.id, {
                  teacher_feedback: feedback || null,
                  submission_status: "pending",
                  answers: [],
                })
              }
            >
              Re-open for student
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
