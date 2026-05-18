/**
 * CVICard — Class Vitality Index card
 * Shows CVI score, teacher grade chip, struggling/excelling counts.
 *
 * Props:
 *   data  { class_name, cvi_score, avg_shs, struggling_count, excelling_count,
 *            total_students, teacher_grade, alert_message }
 */

const GRADE_COLORS = {
  Excellent: "bg-blue-100 text-blue-700",
  Good: "bg-green-100 text-green-700",
  Satisfactory: "bg-amber-100 text-amber-700",
  "Needs Improvement": "bg-red-100 text-red-700",
};

function gradeBg(grade) {
  return GRADE_COLORS[grade] || "bg-gray-100 text-gray-700";
}

export default function CVICard({ data = {} }) {
  const {
    class_name,
    cvi_score,
    avg_shs,
    struggling_count = 0,
    excelling_count = 0,
    total_students = 0,
    teacher_grade,
    alert_message,
  } = data;

  const cvi = parseFloat(cvi_score || 0).toFixed(1);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
            Class Vitality Index
          </p>
          {class_name && (
            <p className="text-sm font-semibold text-gray-800 mt-0.5">
              {class_name}
            </p>
          )}
        </div>
        {teacher_grade && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${gradeBg(teacher_grade)}`}
          >
            {teacher_grade}
          </span>
        )}
      </div>

      <p className="text-4xl font-bold tabular-nums text-gray-900">
        {cvi}
        <span className="text-base font-normal text-gray-400"> / 100</span>
      </p>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-100">
        <div>
          <p className="text-[10px] text-gray-400 uppercase">Avg SHS</p>
          <p className="text-sm font-semibold tabular-nums">
            {parseFloat(avg_shs || 0).toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-amber-500 uppercase">Struggling</p>
          <p className="text-sm font-semibold tabular-nums text-amber-600">
            {struggling_count}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-blue-500 uppercase">Excelling</p>
          <p className="text-sm font-semibold tabular-nums text-blue-600">
            {excelling_count}
          </p>
        </div>
      </div>

      {alert_message && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          ⚠ {alert_message}
        </div>
      )}
    </div>
  );
}
