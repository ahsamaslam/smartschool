import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import studentService from "../../services/studentService";
import { PageSpinner } from "../../components/common/Spinner";
import toast from "react-hot-toast";
import {
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  AcademicCapIcon,
  BookOpenIcon,
  UserCircleIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  );
}

export default function MyEnrollment() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState(null);

  useEffect(() => {
    const studentId = user?.user_id || user?.id;
    if (!studentId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await studentService.getEnrollment(studentId);
        if (!cancel) setEnrollment(res.data);
      } catch {
        if (!cancel) toast.error("Failed to load enrollment details.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [user]);

  if (loading) return <PageSpinner />;

  if (!enrollment || !enrollment.enrolled) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Enrollment</h1>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
          <AcademicCapIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">You are not currently enrolled in any class.</p>
          <p className="text-sm text-gray-400 mt-1">Contact your school admin to get enrolled.</p>
        </div>
      </div>
    );
  }

  const subjects = enrollment.subjects || [];

  return (
    <div className="p-6 max-w-2xl mx-auto pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Enrollment</h1>

      {/* School + Class Info */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm mb-4">
        <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
          <BuildingOfficeIcon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-indigo-900">{enrollment.school_name}</p>
            {enrollment.school_address && (
              <p className="text-xs text-indigo-600">{enrollment.school_address}</p>
            )}
          </div>
        </div>
        <div className="px-5 py-4">
          <InfoRow label="Branch" value={`${enrollment.branch_name}${enrollment.city ? ` — ${enrollment.city}` : ""}`} />
          <InfoRow
            label="Class"
            value={
              enrollment.class_name
                ? `${enrollment.class_name}${enrollment.grade_level ? ` (Class ${enrollment.grade_level}${enrollment.section ? ` ${enrollment.section}` : ""})` : ""}`
                : null
            }
          />
          {enrollment.teacher_name && (
            <InfoRow label="Class Teacher" value={enrollment.teacher_name} />
          )}
          {enrollment.enrolled_at && (
            <InfoRow
              label="Enrolled On"
              value={new Date(enrollment.enrolled_at).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            />
          )}
        </div>
      </div>

      {/* Subjects */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <BookOpenIcon className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Enrolled Subjects</h2>
          <span className="ml-auto text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
            {subjects.length}
          </span>
        </div>
        {subjects.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No subjects assigned yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {subjects.map((sub, i) => (
              <div key={sub.id || i} className="px-5 py-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BookOpenIcon className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">{sub.subject_name}</p>
                  {sub.book_title && (
                    <p className="text-xs text-gray-400 mt-0.5">Book: {sub.book_title}</p>
                  )}
                  {sub.teacher_name && (
                    <p className="text-xs text-indigo-500 mt-0.5 flex items-center gap-1">
                      <UserCircleIcon className="h-3.5 w-3.5" />
                      {sub.teacher_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
