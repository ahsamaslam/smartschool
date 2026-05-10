import { AcademicCapIcon, BuildingLibraryIcon } from "@heroicons/react/24/outline";

/**
 * @param {{
 *   enrollment: { class_name?: string; grade_level?: string; section?: string; class_id?: string };
 *   boardName?: string;
 *   subtitle?: string;
 * }} props
 */
export default function CourseContextHeader({ enrollment, boardName, subtitle }) {
  const grade = enrollment?.grade_level;
  const sec = enrollment?.section;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-5 md:p-6 shadow-sm mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
        <div className="flex gap-4">
          <div className="hidden sm:flex h-14 w-14 shrink-0 rounded-2xl bg-indigo-600 text-white items-center justify-center shadow-md">
            <AcademicCapIcon className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-1">
              Your class
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
              {enrollment?.class_name || "Class"}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {grade != null && grade !== "" && (
                <span className="inline-flex items-center rounded-full bg-white/90 border border-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-900">
                  Grade · {grade}
                </span>
              )}
              {sec != null && sec !== "" && (
                <span className="inline-flex items-center rounded-full bg-white/90 border border-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-900">
                  Section · {sec}
                </span>
              )}
              {boardName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                  <BuildingLibraryIcon className="h-3.5 w-3.5 text-slate-500" />
                  {boardName}
                </span>
              )}
            </div>
            {enrollment?.class_id && (
              <p className="mt-2 text-[11px] font-mono text-slate-400 break-all max-w-xl">
                Section ID: {enrollment.class_id}
              </p>
            )}
          </div>
        </div>
        {subtitle && (
          <p className="text-sm text-slate-600 max-w-md lg:text-right leading-relaxed">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
