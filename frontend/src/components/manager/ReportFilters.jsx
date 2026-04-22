import Dropdown from "../common/Dropdown";
import { REPORT_PERIODS } from "../../utils/constants";

/**
 * ReportFilters — includes "From Beginning" as 6th period option
 * per business guide requirement. When period=all, no start_date is sent.
 */
export default function ReportFilters({
  filters,
  onChange,
  schools = [],
  branches = [],
}) {
  const periodOptions = REPORT_PERIODS.map((p) => ({
    value: p.value,
    label: p.label,
  }));
  const schoolOptions = [
    { value: "", label: "All Schools" },
    ...schools.map((s) => ({ value: s.id, label: s.name })),
  ];
  const branchOptions = [
    { value: "", label: "All Branches" },
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
      {/* Period */}
      <div className="min-w-[160px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Period
        </label>
        <Dropdown
          options={periodOptions}
          value={filters.period || "monthly"}
          onChange={(v) => onChange({ ...filters, period: v })}
        />
      </div>

      {/* School */}
      <div className="min-w-[200px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          School
        </label>
        <Dropdown
          options={schoolOptions}
          value={filters.school_id || ""}
          onChange={(v) =>
            onChange({
              ...filters,
              school_id: v || undefined,
              branch_id: undefined,
            })
          }
        />
      </div>

      {/* Branch */}
      {branches.length > 0 && (
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Branch
          </label>
          <Dropdown
            options={branchOptions}
            value={filters.branch_id || ""}
            onChange={(v) =>
              onChange({ ...filters, branch_id: v || undefined })
            }
          />
        </div>
      )}
    </div>
  );
}
