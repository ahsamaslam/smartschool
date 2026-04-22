import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import Button from "../common/Button";
import Alert from "../common/Alert";
import toast from "react-hot-toast";
import { formatDate } from "../../utils/formatters";

export default function AttendanceForm({ classId, students = [], onSaved }) {
  const { user } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState(() =>
    Object.fromEntries(students.map((s) => [s.id, true])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (studentId) => {
    setRecords((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const presentCount = Object.values(records).filter(Boolean).length;

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await teacherService.markAttendance(user.id, {
        class_id: classId,
        date,
        attendance_records: Object.entries(records).map(
          ([student_id, is_present]) => ({
            student_id,
            is_present,
          }),
        ),
      });
      toast.success("Attendance saved!");
      onSaved?.();
    } catch {
      setError("Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Mark Attendance</h3>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="text-xs text-gray-400 mb-3">
        {presentCount} / {students.length} present
      </div>

      {students.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          No students in this class.
        </p>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {students.map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={records[s.id] ?? true}
              onChange={() => toggle(s.id)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800">{s.full_name}</span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <Button
          variant="primary"
          fullWidth
          onClick={handleSubmit}
          loading={saving}
        >
          Save Attendance
        </Button>
      </div>
    </div>
  );
}
