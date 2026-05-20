import clsx from "clsx";

/**
 * SubjectCard — per business guide, score + avg shown BEFORE subject name
 */
export default function SubjectCard({ subject }) {
  const {
    subject_id,
    subject_name,
    description,
    class_name,
    highest_score,
    my_avg_score,
    average_score,
    total_attempts,
  } = subject;
  // my_avg_score = student's own avg; average_score = class average (used in chart)
  const displayAvg = my_avg_score ?? average_score;

  const scoreColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-500";
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      {/* Scores row — intentionally BEFORE the subject name per business requirement */}
      <div className="flex items-center gap-6 mb-3">
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums leading-none">
            <span className={clsx(scoreColor(highest_score))}>
              {Math.round(highest_score)}
            </span>
            <span className="text-xs text-gray-400 font-normal">%</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Best Score</p>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums leading-none">
            <span className={clsx(scoreColor(displayAvg))}>
              {Math.round(displayAvg)}
            </span>
            <span className="text-xs text-gray-400 font-normal">%</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">My Score</p>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums leading-none text-gray-400">
            {Math.round(average_score)}
            <span className="text-xs font-normal">%</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Class Avg</p>
        </div>
      </div>

      {/* Subject name + class */}
      <h3 className="font-semibold text-gray-900 text-base truncate">
        {subject_name}
      </h3>
      <p className="text-xs text-blue-600 font-medium mt-0.5">{class_name}</p>
      {description && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{description}</p>
      )}
      {total_attempts > 0 && (
        <p className="text-xs text-gray-400 mt-2">{total_attempts} homework{total_attempts !== 1 ? "s" : ""} submitted</p>
      )}
    </div>
  );
}
