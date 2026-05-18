/**
 * RiskDistributionBar
 * Horizontal segmented bar showing % of critical / at_risk / stable / excelling students.
 *
 * Props:
 *   distribution  { critical, at_risk, stable, excelling }  - raw counts or percentages
 *   asPercent     boolean  - if true, values are already %; otherwise counts are converted
 */

const SEGMENTS = [
  { key: "critical", label: "Critical", color: "bg-red-500" },
  { key: "at_risk", label: "At Risk", color: "bg-amber-400" },
  { key: "stable", label: "Stable", color: "bg-green-500" },
  { key: "excelling", label: "Excelling", color: "bg-blue-500" },
];

export default function RiskDistributionBar({
  distribution = {},
  asPercent = false,
}) {
  const total = asPercent
    ? 100
    : Object.values(distribution).reduce((s, v) => s + (v || 0), 0) || 1;

  const segments = SEGMENTS.map((s) => ({
    ...s,
    pct: Math.round(((distribution[s.key] || 0) / total) * 100),
    count: distribution[s.key] || 0,
  }));

  return (
    <div className="space-y-1.5">
      {/* Bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {segments.map((s) =>
          s.pct > 0 ? (
            <div
              key={s.key}
              title={`${s.label}: ${s.pct}%`}
              className={`${s.color} transition-all`}
              style={{ width: `${s.pct}%` }}
            />
          ) : null,
        )}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1 text-[10px] text-gray-500"
          >
            <span className={`inline-block w-2 h-2 rounded-full ${s.color}`} />
            {s.label}
            <span className="font-semibold text-gray-700">{s.count}</span>
            <span className="opacity-60">({s.pct}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}
