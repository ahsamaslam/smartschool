import { Link } from "react-router-dom";
import { PlayCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { PlayCircleIcon as PlayCircleSolid } from "@heroicons/react/24/solid";
import clsx from "clsx";
import { isToday } from "../../utils/dateUtils";
import { formatDate } from "../../utils/formatters";

/**
 * TopicList — splits topics into "Today's Topic" and "Previous Topics"
 * per business guide requirement
 */
export default function TopicList({ topics = [] }) {
  const todayTopics = topics.filter(
    (t) => t.published_date && isToday(t.published_date),
  );
  const previousTopics = topics.filter(
    (t) => t.published_date && !isToday(t.published_date),
  );
  const unpublished = topics.filter((t) => !t.published_date);

  return (
    <div className="space-y-6">
      {todayTopics.length > 0 && (
        <Section title="Today's Topic" accent="blue" topics={todayTopics} />
      )}
      {previousTopics.length > 0 && (
        <Section
          title="Previous Topics"
          accent="gray"
          topics={previousTopics}
        />
      )}
      {unpublished.length > 0 && (
        <Section
          title="Upcoming Topics"
          accent="gray"
          topics={unpublished}
          locked
        />
      )}
      {topics.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          No topics available yet.
        </p>
      )}
    </div>
  );
}

function Section({ title, accent, topics, locked = false }) {
  return (
    <div>
      <h3
        className={clsx(
          "text-xs font-semibold uppercase tracking-widest mb-3",
          accent === "blue" ? "text-blue-600" : "text-gray-400",
        )}
      >
        {title}
      </h3>
      <div className="space-y-2">
        {topics.map((topic) => (
          <TopicRow key={topic.topic_id} topic={topic} locked={locked} />
        ))}
      </div>
    </div>
  );
}

function TopicRow({ topic, locked }) {
  const watched = (topic.completion_percentage || 0) >= 100;
  const inProgress = !watched && (topic.completion_percentage || 0) > 0;
  const hasVideo = !!topic.video_id;

  const content = (
    <div
      className={clsx(
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
        locked || !hasVideo
          ? "border-gray-100 bg-gray-50 cursor-default opacity-60"
          : "border-gray-200 bg-white hover:shadow-sm hover:border-blue-300 cursor-pointer",
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {watched ? (
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
        ) : inProgress ? (
          <PlayCircleSolid className="h-5 w-5 text-blue-500" />
        ) : (
          <PlayCircleIcon className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {topic.title}
        </p>
        {topic.published_date && (
          <p className="text-xs text-gray-400">
            Published {formatDate(topic.published_date)}
          </p>
        )}
      </div>

      {/* Progress badge */}
      {inProgress && (
        <span className="flex-shrink-0 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          {Math.round(topic.completion_percentage)}%
        </span>
      )}
    </div>
  );

  if (!locked && hasVideo) {
    return <Link to={`/student/video/${topic.video_id}`}>{content}</Link>;
  }
  return content;
}
