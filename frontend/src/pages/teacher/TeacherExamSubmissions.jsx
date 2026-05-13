import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import examService from "../../services/examService";
import { PageSpinner } from "../../components/common/Spinner";
import IntegrityReportDashboard from "../../components/teacher/IntegrityReportDashboard";

function statusLabel(status) {
  const map = {
    pending: "Pending",
    in_progress: "In Progress",
    submitted: "Submitted",
    graded: "Graded",
  };
  return map[status] || status || "—";
}

export default function TeacherExamSubmissions() {
  const { user } = useAuth();
  const { examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  const filteredSubmissions = submissions.filter((sub) =>
    (sub.student_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (sub.student_email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    loadData();
  }, [examId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const examRes = await examService.getExamForTeacher(examId, user.id);
      setExam(examRes.data);

      // Get exam submissions (similar to homework submissions)
      const subRes = await examService.getExamSubmissions(examId);
      setSubmissions(subRes.data?.data || []);
    } catch (error) {
      toast.error("Failed to load exam submissions");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (!exam) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto pb-20">
      <button
        type="button"
        onClick={() => navigate(`/teacher/exams`)}
        className="text-sm text-gray-500 mb-4"
      >
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Exam submissions</h1>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Teacher / admin only</p>
      {exam && (
        <p className="text-sm text-gray-500 mb-4">
          {exam.title} · {exam.questions_count || 0} questions
        </p>
      )}

      {/* Integrity Report Dashboard */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Academic Integrity Monitoring</h2>
        <p className="text-sm text-gray-600 mb-4">
          Automated tracking of paste events, typing patterns, and tab switches for written answers.
        </p>
        <IntegrityReportDashboard homeworkId={examId} isExam={true} />
      </div>

      {/* Submissions List */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-700">All Submissions ({filteredSubmissions.length})</h2>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
          />
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            {searchQuery ? "No students match your search." : "No submissions yet."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Student</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Submitted</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Score</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSubmissions.map((sub) => {
                  const isSelected = selectedSubmissionId === sub.id;
                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{sub.student_name}</p>
                        <p className="text-xs text-gray-500">{sub.student_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {statusLabel(sub.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {sub.submitted_at
                          ? new Date(sub.submitted_at).toLocaleDateString()
                          : "Not submitted"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {sub.score != null ? (
                          <>
                            {sub.score} {sub.total_marks ? `/ ${sub.total_marks}` : ""}
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
                          {isSelected ? "Collapse" : "View"}
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

      {/* Selected Submission Detail */}
      {selectedSubmissionId && (
        <div className="border-t pt-8">
          <p className="text-sm text-gray-600 text-center py-4">
            Detailed submission view coming soon
          </p>
        </div>
      )}
    </div>
  );
}
