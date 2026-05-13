import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import Button from "../common/Button";
import Alert from "../common/Alert";
import toast from "react-hot-toast";
import clsx from "clsx";

function formatApiError(err, fallback = "Failed to save attendance.") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first === "string") return first;
    if (first?.msg) return first.msg;
  }
  if (detail && typeof detail === "object" && detail.msg) return detail.msg;
  if (typeof err?.message === "string") return err.message;
  return fallback;
}

export default function AttendanceForm({
  classId,
  students = [],
  teacherId,
  onSaved,
}) {
  const { user } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState(() =>
    Object.fromEntries(students.map((s) => [s.id, true])),
  );
  const [saving, setSaving] = useState(false);
  const [loadingDateState, setLoadingDateState] = useState(false);
  const [isSavedForDate, setIsSavedForDate] = useState(false);
  const [allowEdit, setAllowEdit] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRecords(Object.fromEntries(students.map((s) => [s.id, true])));
  }, [students]);

  useEffect(() => {
    if (!classId || !date) return;
    setLoadingDateState(true);
    setError("");
    teacherService
      .getAttendance(classId, date, date)
      .then((res) => {
        const rows = res?.data || [];
        if (!rows.length) {
          setIsSavedForDate(false);
          setAllowEdit(false);
          setRecords(Object.fromEntries(students.map((s) => [s.id, true])));
          return;
        }
        const next = Object.fromEntries(students.map((s) => [s.id, true]));
        rows.forEach((r) => {
          if (r?.student_id) next[r.student_id] = Boolean(r.is_present);
        });
        setRecords(next);
        setIsSavedForDate(true);
        setAllowEdit(false);
      })
      .catch(() => {
        setIsSavedForDate(false);
        setAllowEdit(false);
      })
      .finally(() => setLoadingDateState(false));
  }, [classId, date, students]);

  const setStatus = (studentId, isPresent) => {
    setRecords((prev) => ({ ...prev, [studentId]: isPresent }));
  };

  const presentCount = useMemo(
    () => Object.values(records).filter(Boolean).length,
    [records],
  );

  const handleSubmit = async () => {
    if (!students.length) {
      setError("No students found for attendance.");
      return;
    }

    const attendanceRecords = Object.entries(records)
      .filter(([student_id]) => Boolean(student_id))
      .map(([student_id, is_present]) => ({
        student_id: String(student_id),
        is_present: Boolean(is_present),
      }));

    if (!attendanceRecords.length) {
      setError("No valid attendance records to save.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await teacherService.markAttendance(teacherId || user?.id, {
        class_id: classId,
        date,
        attendance_records: attendanceRecords,
      }, allowEdit);
      toast.success("Attendance saved!");
      setIsSavedForDate(true);
      setAllowEdit(false);
      onSaved?.();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name) => {
    const colors = [
      "bg-blue-100 text-blue-700",
      "bg-purple-100 text-purple-700",
      "bg-pink-100 text-pink-700",
      "bg-green-100 text-green-700",
      "bg-orange-100 text-orange-700",
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-gray-800">Mark Attendance</h3>
          <p className="text-xs text-gray-500 mt-1">
            {presentCount} / {students.length} present
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {students.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No students in this class.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Student</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Class</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Section</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((s) => {
                const isPresent = records[s.id] !== false;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${getAvatarColor(
                            s.full_name
                          )}`}
                        >
                          {getInitials(s.full_name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{s.full_name}</p>
                          <p className="text-xs text-gray-500">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{s.class_name || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{s.section || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {isPresent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                          Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                          Absent
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setStatus(s.id, true)}
                          disabled={loadingDateState || (isSavedForDate && !allowEdit)}
                          className={clsx(
                            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                            records[s.id] !== false
                              ? "bg-green-100 text-green-700 border border-green-300"
                              : "border border-green-300 text-green-700 hover:bg-green-50"
                          )}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(s.id, false)}
                          disabled={loadingDateState || (isSavedForDate && !allowEdit)}
                          className={clsx(
                            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                            records[s.id] === false
                              ? "bg-red-100 text-red-700 border border-red-300"
                              : "border border-red-300 text-red-700 hover:bg-red-50"
                          )}
                        >
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {isSavedForDate && !allowEdit ? (
          <button
            type="button"
            onClick={() => setAllowEdit(true)}
            className="w-full rounded-lg border border-amber-300 bg-amber-50 text-amber-800 py-2 text-sm font-semibold hover:bg-amber-100"
          >
            Edit Attendance
          </button>
        ) : null}
        <Button
          variant="primary"
          fullWidth
          onClick={handleSubmit}
          loading={saving || loadingDateState}
          disabled={isSavedForDate && !allowEdit}
        >
          {isSavedForDate && !allowEdit
            ? "Attendance Saved"
            : allowEdit
              ? "Update Attendance"
              : "Save Attendance"}
        </Button>
      </div>
    </div>
  );
}
