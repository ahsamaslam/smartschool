/**
 * SHSCard  — Student Health Score card
 * Shows current SHS, risk level badge, weekly/monthly averages, and momentum.
 *
 * Props:
 *   scores  { current_shs, weekly_shs, monthly_shs, momentum, risk_level }
 */
import ScoreBadge from "./ScoreBadge";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from "@heroicons/react/24/outline";

export default function SHSCard({ scores = {} }) {
  const { current_shs, weekly_shs, monthly_shs, momentum, risk_level } = scores;
  const mom = parseFloat(momentum || 0);

  const MomentumIcon =
    mom > 2
      ? ArrowTrendingUpIcon
      : mom < -2
        ? ArrowTrendingDownIcon
        : MinusIcon;
  const momColor =
    mom > 2 ? "text-green-600" : mom < -2 ? "text-red-600" : "text-gray-400";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Student Health Score
        </p>
        <ScoreBadge
          score={parseFloat(current_shs || 0).toFixed(1)}
          riskLevel={risk_level}
        />
      </div>
      <p className="text-4xl font-bold tabular-nums text-gray-900">
        {current_shs !== undefined ? parseFloat(current_shs).toFixed(1) : "—"}
        <span className="text-base font-normal text-gray-400"> / 100</span>
      </p>
      <div className="flex items-center gap-2">
        <MomentumIcon className={`h-4 w-4 ${momColor}`} />
        <span className={`text-xs font-semibold ${momColor}`}>
          {mom > 0 ? "+" : ""}
          {mom.toFixed(1)}% vs last week
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">
            7-Day Avg
          </p>
          <p className="text-sm font-semibold tabular-nums text-gray-700">
            {weekly_shs !== undefined ? parseFloat(weekly_shs).toFixed(1) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">
            30-Day Avg
          </p>
          <p className="text-sm font-semibold tabular-nums text-gray-700">
            {monthly_shs !== undefined
              ? parseFloat(monthly_shs).toFixed(1)
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
