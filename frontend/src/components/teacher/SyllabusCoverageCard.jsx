import { useState, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import lessonService from "../../services/lessonService";

export function SyllabusCoverageCard({
  teacherId,
  classId,
  librarySubjectId,
  loading = false,
}) {
  const [coverage, setCoverage] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedStatus, setExpandedStatus] = useState("not_planned");

  useEffect(() => {
    if (teacherId && classId && librarySubjectId) {
      loadCoverage();
    }
  }, [teacherId, classId, librarySubjectId]);

  const loadCoverage = async () => {
    try {
      const response = await lessonService.getSyllabusCoverage(
        teacherId,
        classId,
        librarySubjectId
      );
      setCoverage(response.data);
    } catch (error) {
      console.error("Error loading coverage:", error);
    }
  };

  if (!teacherId || !classId || !librarySubjectId) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-gray-500 text-sm">
        Select a class and subject to view coverage
      </div>
    );
  }

  if (loading || !coverage) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-gray-500">
        Loading coverage data...
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getTopicsByStatus = (status) => {
    return (coverage.topics_by_status || []).filter((t) => t.status === status);
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
            Total Topics
          </p>
          <p className="text-2xl font-bold text-blue-900 mt-1">
            {coverage.total_topics}
          </p>
        </div>

        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">
            Planned
          </p>
          <p className="text-2xl font-bold text-yellow-900 mt-1">
            {coverage.planned_topics}
          </p>
          <p className="text-xs text-yellow-700 mt-0.5">
            {coverage.total_topics > 0
              ? Math.round((coverage.planned_topics / coverage.total_topics) * 100)
              : 0}
            %
          </p>
        </div>

        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wide">
            Covered
          </p>
          <p className="text-2xl font-bold text-green-900 mt-1">
            {coverage.covered_topics}
          </p>
          <p className="text-xs text-green-700 mt-0.5">
            {coverage.total_topics > 0
              ? Math.round((coverage.covered_topics / coverage.total_topics) * 100)
              : 0}
            %
          </p>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            Not Planned
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {coverage.total_topics - coverage.planned_topics}
          </p>
          <p className="text-xs text-gray-700 mt-0.5">
            {coverage.total_topics > 0
              ? Math.round(
                  ((coverage.total_topics - coverage.planned_topics) /
                    coverage.total_topics) *
                    100
                )
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Coverage Progress Bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
        <p className="text-sm font-semibold text-gray-900">Coverage Progress</p>
        <div className="flex gap-1 h-6 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          {coverage.covered_topics > 0 && (
            <div
              className="bg-green-500 h-full flex items-center justify-center text-xs font-bold text-white"
              style={{
                width: `${Math.round(
                  (coverage.covered_topics / coverage.total_topics) * 100
                )}%`,
              }}
              title={`${coverage.covered_topics} covered`}
            >
              {coverage.total_topics > 8 && (
                <span>
                  {Math.round(
                    (coverage.covered_topics / coverage.total_topics) * 100
                  )}
                  %
                </span>
              )}
            </div>
          )}
          {coverage.planned_topics - coverage.covered_topics > 0 && (
            <div
              className="bg-yellow-400 h-full flex items-center justify-center text-xs font-bold text-white"
              style={{
                width: `${Math.round(
                  ((coverage.planned_topics - coverage.covered_topics) /
                    coverage.total_topics) *
                    100
                )}%`,
              }}
              title={`${coverage.planned_topics - coverage.covered_topics} planned`}
            >
              {coverage.total_topics > 12 && (
                <span>
                  {Math.round(
                    ((coverage.planned_topics - coverage.covered_topics) /
                      coverage.total_topics) *
                      100
                  )}
                  %
                </span>
              )}
            </div>
          )}
          {coverage.total_topics - coverage.planned_topics > 0 && (
            <div
              className="bg-gray-300 h-full flex items-center justify-center text-xs font-bold text-gray-700"
              style={{
                width: `${Math.round(
                  ((coverage.total_topics - coverage.planned_topics) /
                    coverage.total_topics) *
                    100
                )}%`,
              }}
              title={`${coverage.total_topics - coverage.planned_topics} not planned`}
            >
              {coverage.total_topics > 12 && (
                <span>
                  {Math.round(
                    ((coverage.total_topics - coverage.planned_topics) /
                      coverage.total_topics) *
                      100
                  )}
                  %
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Topics by Status */}
      <div className="space-y-2">
        {/* Covered Topics */}
        {getTopicsByStatus("covered").length > 0 && (
          <div className="border border-green-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setExpandedStatus(expandedStatus === "covered" ? "" : "covered")
              }
              className="w-full p-3 bg-green-50 hover:bg-green-100 flex items-center justify-between transition"
            >
              <span className="font-semibold text-green-900">
                ✓ Covered Topics ({getTopicsByStatus("covered").length})
              </span>
              <ChevronDownIcon
                className={`h-4 w-4 text-green-600 transform transition ${
                  expandedStatus === "covered" ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>
            {expandedStatus === "covered" && (
              <div className="p-3 space-y-2 bg-white">
                {getTopicsByStatus("covered").map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-start justify-between gap-2 p-2 bg-green-50 rounded text-sm"
                  >
                    <div>
                      <p className="font-medium text-green-900">
                        {topic.chapter_number && `Ch${topic.chapter_number}: `}
                        {topic.title}
                      </p>
                      <p className="text-xs text-green-700">
                        Covered on {formatDate(topic.covered_date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Planned Topics */}
        {getTopicsByStatus("planned").length > 0 && (
          <div className="border border-yellow-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setExpandedStatus(expandedStatus === "planned" ? "" : "planned")
              }
              className="w-full p-3 bg-yellow-50 hover:bg-yellow-100 flex items-center justify-between transition"
            >
              <span className="font-semibold text-yellow-900">
                ▸ Planned Topics ({getTopicsByStatus("planned").length})
              </span>
              <ChevronDownIcon
                className={`h-4 w-4 text-yellow-600 transform transition ${
                  expandedStatus === "planned" ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>
            {expandedStatus === "planned" && (
              <div className="p-3 space-y-2 bg-white">
                {getTopicsByStatus("planned").map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-start justify-between gap-2 p-2 bg-yellow-50 rounded text-sm"
                  >
                    <div>
                      <p className="font-medium text-yellow-900">
                        {topic.chapter_number && `Ch${topic.chapter_number}: `}
                        {topic.title}
                      </p>
                      <p className="text-xs text-yellow-700">
                        Planned for {formatDate(topic.planned_date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Not Planned Topics */}
        {getTopicsByStatus("not_planned").length > 0 && (
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setExpandedStatus(expandedStatus === "not_planned" ? "" : "not_planned")
              }
              className="w-full p-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition"
            >
              <span className="font-semibold text-gray-900">
                ○ Not Planned ({getTopicsByStatus("not_planned").length})
              </span>
              <ChevronDownIcon
                className={`h-4 w-4 text-gray-600 transform transition ${
                  expandedStatus === "not_planned" ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>
            {expandedStatus === "not_planned" && (
              <div className="p-3 space-y-2 bg-white max-h-64 overflow-y-auto">
                {getTopicsByStatus("not_planned").map((topic) => (
                  <div
                    key={topic.id}
                    className="flex items-start justify-between gap-2 p-2 bg-gray-50 rounded text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {topic.chapter_number && `Ch${topic.chapter_number}: `}
                        {topic.title}
                      </p>
                      <p className="text-xs text-gray-600">
                        Not yet planned for this class
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
