/**
 * ScoreBadge
 * Colored pill showing a score value and risk/grade label.
 * Risk levels: critical (red), at_risk (yellow), stable (green), excelling (blue)
 *
 * Props:
 *   score      number  - 0-100
 *   label      string  - optional override label
 *   riskLevel  string  - critical | at_risk | stable | excelling (auto if omitted)
 *   size       string  - sm | md (default md)
 */

const RISK_COLORS = {
  critical: "bg-red-100 text-red-700 border-red-200",
  at_risk: "bg-amber-100 text-amber-700 border-amber-200",
  stable: "bg-green-100 text-green-700 border-green-200",
  excelling: "bg-blue-100 text-blue-700 border-blue-200",
};

function getRiskLevel(score) {
  if (score < 40) return "critical";
  if (score < 60) return "at_risk";
  if (score < 80) return "stable";
  return "excelling";
}

export default function ScoreBadge({ score, label, riskLevel, size = "md" }) {
  const level = riskLevel || getRiskLevel(score ?? 0);
  const colorClass = RISK_COLORS[level] || RISK_COLORS.stable;
  const displayLabel = label || level.replace("_", " ");

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-full font-semibold tabular-nums
        ${size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"}
        ${colorClass}`}
    >
      {score !== undefined && score !== null ? `${score}` : "—"}
      <span className="opacity-70 capitalize font-normal">{displayLabel}</span>
    </span>
  );
}
