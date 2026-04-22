import clsx from "clsx";
import { formatDate } from "../../utils/formatters";

/**
 * PerformanceTable — topic-wise AND day-wise breakdown per business guide
 */
export default function PerformanceTable({ data = [] }) {
  if (!data.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No performance data available.
      </p>
    );
  }

  const scoreCell = (value) => {
    const v = Math.round(value || 0);
    return (
      <span
        className={clsx(
          "inline-block px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums",
          v >= 80
            ? "bg-green-100 text-green-700"
            : v >= 60
              ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-600",
        )}
      >
        {v}%
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
            <th className="text-left py-3 px-4">Topic</th>
            <th className="text-center py-3 px-4">Subject</th>
            <th className="text-center py-3 px-4">Published</th>
            <th className="text-center py-3 px-4">Video %</th>
            <th className="text-center py-3 px-4">Quiz Avg</th>
            <th className="text-center py-3 px-4">Best Score</th>
            <th className="text-center py-3 px-4">Attempts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="py-3 px-4 font-medium text-gray-800">
                {row.topic_name}
              </td>
              <td className="py-3 px-4 text-center text-gray-500">
                {row.subject_name}
              </td>
              <td className="py-3 px-4 text-center text-gray-400 text-xs">
                {row.published_date ? formatDate(row.published_date) : "—"}
              </td>
              <td className="py-3 px-4 text-center">
                {scoreCell(row.video_completion)}
              </td>
              <td className="py-3 px-4 text-center">
                {scoreCell(row.average_quiz_score)}
              </td>
              <td className="py-3 px-4 text-center">
                {scoreCell(row.highest_quiz_score)}
              </td>
              <td className="py-3 px-4 text-center text-gray-500">
                {row.quiz_attempts || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
