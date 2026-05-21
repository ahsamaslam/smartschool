import { useEffect, useState } from "react";
import managerService from "../../services/managerService";
import ReportFilters from "../../components/manager/ReportFilters";
import ReportTable from "../../components/manager/ReportTable";
import Alert from "../../components/common/Alert";

const COLUMNS = [
  { key: "full_name", label: "Student", bold: true },
  { key: "class_name", label: "Class" },
  { key: "branch_name", label: "Branch" },
  {
    key: "avg_video_completion",
    label: "Video %",
    type: "score",
    align: "center",
  },
  {
    key: "avg_attendance",
    label: "Attendance %",
    type: "score",
    align: "center",
  },
  { key: "avg_homework_score", label: "Homework Score", type: "score", align: "center" },
  {
    key: "avg_overall_score",
    label: "Overall",
    type: "score",
    align: "center",
  },
];

export default function StudentReports() {
  const [schools, setSchools] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({ period: "monthly" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    managerService.getSchools().then((res) => setSchools(res.data || []));
  }, []);

  useEffect(() => {
    if (filters.school_id) {
      managerService
        .getSchoolBranches(filters.school_id)
        .then((res) => setBranches(res.data || []));
    } else {
      setBranches([]);
    }
  }, [filters.school_id]);

  useEffect(() => {
    setLoading(true);
    setError("");
    managerService
      .getStudentReports(filters)
      .then((res) => setRows(res.data?.students || []))
      .catch(() => setError("Failed to load report."))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Student Reports</h1>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="mb-6">
        <ReportFilters
          filters={filters}
          onChange={setFilters}
          schools={schools}
          branches={branches}
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <ReportTable columns={COLUMNS} rows={rows} loading={loading} />
      </div>
    </div>
  );
}
