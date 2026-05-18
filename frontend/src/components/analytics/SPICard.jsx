/**
 * SPICard — School Performance Index card
 * Shows SPI score, rating chip, and key stats.
 *
 * Props:
 *   data  { school_name, spi_score, avg_shs, avg_cvi, at_risk_percentage,
 *            top_performers_percentage, rating }
 *   onClick  fn  (optional drill-down)
 */

const RATING_COLORS = {
  Outstanding: "bg-purple-100 text-purple-700",
  Excellent: "bg-blue-100 text-blue-700",
  Good: "bg-green-100 text-green-700",
  Satisfactory: "bg-amber-100 text-amber-700",
  "Needs Improvement": "bg-red-100 text-red-700",
};

function ratingBg(rating) {
  return RATING_COLORS[rating] || "bg-gray-100 text-gray-600";
}

export default function SPICard({ data = {}, onClick }) {
  const {
    school_name,
    spi_score,
    avg_shs,
    avg_cvi,
    at_risk_percentage = 0,
    top_performers_percentage = 0,
    rating,
  } = data;

  const spi = parseFloat(spi_score || 0).toFixed(1);

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-gray-200 bg-white p-4 space-y-3 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
            School Performance Index
          </p>
          {school_name && (
            <p className="text-sm font-semibold text-gray-800 mt-0.5">
              {school_name}
            </p>
          )}
        </div>
        {rating && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ratingBg(rating)}`}
          >
            {rating}
          </span>
        )}
      </div>

      <p className="text-4xl font-bold tabular-nums text-gray-900">
        {spi}
        <span className="text-base font-normal text-gray-400"> / 100</span>
      </p>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
        <div>
          <p className="text-[10px] text-gray-400 uppercase">Avg SHS</p>
          <p className="text-sm font-semibold tabular-nums">
            {parseFloat(avg_shs || 0).toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase">Avg CVI</p>
          <p className="text-sm font-semibold tabular-nums">
            {parseFloat(avg_cvi || 0).toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-red-400 uppercase">At Risk</p>
          <p className="text-sm font-semibold tabular-nums text-red-600">
            {parseFloat(at_risk_percentage || 0).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] text-blue-400 uppercase">Top Performers</p>
          <p className="text-sm font-semibold tabular-nums text-blue-600">
            {parseFloat(top_performers_percentage || 0).toFixed(1)}%
          </p>
        </div>
      </div>

      {onClick && (
        <p className="text-xs text-indigo-500 font-medium text-right">
          View details →
        </p>
      )}
    </div>
  );
}
