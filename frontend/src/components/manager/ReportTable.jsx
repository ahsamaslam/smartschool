import clsx from "clsx";

export default function ReportTable({
  columns = [],
  rows = [],
  loading = false,
}) {
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

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Loading report…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        No data for selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  "py-3 px-4",
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left",
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    "py-3 px-4",
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left",
                  )}
                >
                  {col.type === "score" ? (
                    scoreCell(row[col.key])
                  ) : col.type === "number" ? (
                    <span className="tabular-nums">
                      {Math.round(row[col.key] || 0)}
                    </span>
                  ) : (
                    <span
                      className={
                        col.bold ? "font-medium text-gray-900" : "text-gray-600"
                      }
                    >
                      {row[col.key] ?? "—"}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
