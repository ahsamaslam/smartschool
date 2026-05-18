/**
 * PeriodFilter
 * Dropdown: Last Month | Last Year | Custom (date range picker)
 * Used by Teacher, Manager, and Admin dashboards.
 *
 * Props:
 *   period       string  - current period value
 *   start        string  - custom start date (ISO)
 *   end          string  - custom end date (ISO)
 *   onChange     fn({ period, start, end })
 */
import { Fragment } from "react";
import { CalendarDaysIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

const PRESETS = [
  { value: "last_month", label: "Last Month" },
  { value: "last_year", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

export default function PeriodFilter({ period, start, end, onChange }) {
  const handlePreset = (e) => {
    const val = e.target.value;
    if (val !== "custom") {
      onChange({ period: val, start: undefined, end: undefined });
    } else {
      onChange({ period: val, start, end });
    }
  };

  const handleDate = (field) => (e) => {
    const next = { period, start, end, [field]: e.target.value };
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative inline-flex items-center">
        <CalendarDaysIcon className="absolute left-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        <select
          value={period}
          onChange={handlePreset}
          className="pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none"
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
      </div>

      {period === "custom" && (
        <Fragment>
          <input
            type="date"
            value={start || ""}
            onChange={handleDate("start")}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={end || ""}
            onChange={handleDate("end")}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </Fragment>
      )}
    </div>
  );
}
