import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import adminService from "../../services/adminService";

const RATING_COLORS = {
  Outstanding:        "bg-purple-100 text-purple-700",
  Excellent:          "bg-blue-100 text-blue-700",
  Good:               "bg-green-100 text-green-700",
  Satisfactory:       "bg-amber-100 text-amber-700",
  "Needs Improvement":"bg-red-100 text-red-700",
  "No data":          "bg-gray-100 text-gray-500",
};

function bpiRating(score) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Satisfactory";
  return "Needs Improvement";
}

function ratingClass(rating) {
  return RATING_COLORS[rating] || "bg-gray-100 text-gray-500";
}

function cviColor(score) {
  if (score >= 75) return "text-green-700 bg-green-50";
  if (score >= 60) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

export default function SchoolPerformance() {
  const { schoolId } = useParams();
  const navigate = useNavigate();

  const [school, setSchool] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);

    async function load() {
      const [schoolRes, classesRes] = await Promise.all([
        adminService.getSchoolAnalytics(schoolId),
        adminService.getSchoolClassAnalytics(schoolId),
      ]);

      const schoolData = schoolRes.data;
      const allClasses = classesRes.data?.classes || [];

      // Group classes by branch_id for class count
      const classMap = {};
      for (const cls of allClasses) {
        const bid = cls.branch_id;
        if (!classMap[bid]) classMap[bid] = [];
        classMap[bid].push(cls);
      }

      const rawBranches = (schoolData.branches || []).map((b) => ({
        ...b,
        bpi: 0,
        class_count: (classMap[b.branch_id] || []).length,
        classes: classMap[b.branch_id] || [],
      }));

      // Load live BPI for every branch in parallel (same live computation as manager)
      const liveResults = await Promise.allSettled(
        rawBranches.map((b) =>
          adminService.getBranchLiveAnalytics(schoolId, b.branch_id)
        )
      );

      const branchList = rawBranches.map((b, i) => {
        const r = liveResults[i];
        if (r.status === "fulfilled" && r.value.data) {
          return {
            ...b,
            bpi: r.value.data.bpi || 0,
            student_count: r.value.data.total_students ?? b.student_count,
            class_count: r.value.data.total_classes || b.class_count,
          };
        }
        return b;
      });

      setSchool(schoolData);
      setBranches(branchList);
    }

    load().catch(() => {}).finally(() => setLoading(false));
  }, [schoolId]);

  const spi = school?.spi || {};
  const spiScore = parseFloat(spi.spi_score || 0).toFixed(1);
  const spiRating = spi.rating
    ? spi.rating.split(" - ")[0]
    : "No data";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate("/admin/schools")}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {school?.school_name || "School Performance"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">School Performance Index</p>
        </div>
        {spi.spi_score != null && (
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-gray-900">
              {spiScore}
              <span className="text-sm font-normal text-gray-400"> / 100</span>
            </p>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ratingClass(spiRating)}`}>
              {spiRating}
            </span>
          </div>
        )}
      </div>

      {/* SPI summary strip */}
      {spi.spi_score > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: "Avg SHS", value: parseFloat(spi.avg_shs || 0).toFixed(1), color: "text-indigo-700" },
            { label: "Avg CVI", value: parseFloat(spi.avg_cvi || 0).toFixed(1), color: "text-blue-700" },
            { label: "At Risk", value: `${parseFloat(spi.at_risk_percentage || 0).toFixed(1)}%`, color: "text-red-600" },
            { label: "Top Performers", value: `${parseFloat(spi.top_performers_percentage || 0).toFixed(1)}%`, color: "text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Branches */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Branch Performance Index
      </h2>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading…</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">No branches found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {branches.map((b) => {
            const bpi = b.bpi.toFixed(1);
            const rating = b.bpi > 0 ? bpiRating(b.bpi) : "No data";
            return (
              <button
                key={b.branch_id}
                type="button"
                onClick={() =>
                  navigate(
                    `/admin/schools/${schoolId}/branches/${b.branch_id}/performance`,
                    { state: { branchName: b.branch_name, classes: b.classes } },
                  )
                }
                className="text-left bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <BuildingOffice2Icon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <p className="font-semibold text-gray-800">{b.branch_name}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ratingClass(rating)}`}>
                    {rating}
                  </span>
                </div>

                <p className="text-3xl font-bold tabular-nums text-gray-900 mb-1">
                  {b.bpi > 0 ? bpi : "—"}
                  {b.bpi > 0 && <span className="text-sm font-normal text-gray-400"> / 100</span>}
                </p>
                <p className="text-xs text-gray-400 mb-3">Branch Performance Index</p>

                <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
                  <span>{b.class_count} class{b.class_count !== 1 ? "es" : ""}</span>
                  <span>{b.student_count} student{b.student_count !== 1 ? "s" : ""}</span>
                  <span className="ml-auto text-indigo-500 font-medium group-hover:underline">
                    View Details →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
