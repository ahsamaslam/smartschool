import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Distinct bar fills (reference-style multi-color chart). */
const BAR_COLORS = [
  "#d00078",
  "#0891b2",
  "#fb7185",
  "#f97316",
  "#6366f1",
  "#0f766e",
  "#1e3a5f",
  "#c026d3",
  "#0ea5e9",
  "#ca8a04",
];

export default function AttendanceBarChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-52 text-sm text-gray-400">
        No attendance data yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-center items-center gap-2 text-xs font-medium text-gray-700 mb-2">
        <span className="inline-block w-3.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: BAR_COLORS[0] }} />
        Attendance in %
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 12, left: 4, bottom: 56 }}
          barCategoryGap="28%"
          barGap={6}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#eceff3" vertical={false} />
          <XAxis
            dataKey="course"
            interval={0}
            height={52}
            tick={{ fontSize: 11, fill: "#4b5563" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            angle={-18}
            textAnchor="end"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)}%`, "Attendance"]}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload;
              return p?.full_label || p?.course || "";
            }}
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
          />
          <Bar dataKey="attendance_percent" name="Attendance in %" maxBarSize={52} radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={`cell-${i}`} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-gray-500 text-center mt-1 px-2">
        Each bar is one enrolled subject (section attendance %). Hover for full name.
      </p>
    </div>
  );
}
