import { useEffect, useState } from "react";
import managerService from "../../services/managerService";
import ReportFilters from "../../components/manager/ReportFilters";
import ReportTable from "../../components/manager/ReportTable";
import Alert from "../../components/common/Alert";

const COLUMNS = [
  { key: "full_name", label: "Teacher", bold: true },
  { key: "school_name", label: "School" },
  { key: "branch_name", label: "Branch" },
  { key: "class_count", label: "Classes", type: "number", align: "center" },
  { key: "student_count", label: "Students", type: "number", align: "center" },
  { key: "videos_published", label: "Videos", type: "number", align: "center" },
  {
    key: "avg_class_performance",
    label: "Class Avg",
    type: "score",
    align: "center",
  },
];

export default function TeacherReports() {
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
      .getTeacherReports(filters)
      .then((res) => setRows(res.data?.teachers || []))
      .catch(() => setError("Failed to load report."))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Teacher Reports</h1>

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
