import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from "recharts";

const MY_SCORE_COLOR   = "#1d4ed8";
const BEST_SCORE_COLOR = "#f59e0b";
const CLASS_AVG_COLOR  = "#93c5fd";

function renderCustomLabel(props, color) {
  const { x, y, width, value } = props;
  if (!value || value === 0) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 5}
      fill={color}
      textAnchor="middle"
      fontSize={11}
      fontWeight={600}
    >
      {Math.round(value)}
    </text>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "10px 14px",
      fontSize: 12,
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      minWidth: 150,
    }}>
      <p style={{ fontWeight: 700, color: "#111", marginBottom: 8 }}>{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b7280" }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: p.fill }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 700, color: p.fill }}>{Number(p.value).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend() {
  const items = [
    { color: MY_SCORE_COLOR,   label: "My Score"   },
    { color: BEST_SCORE_COLOR, label: "Best Score"  },
    { color: CLASS_AVG_COLOR,  label: "Class Avg"   },
  ];
  return (
    <div style={{ display: "flex", gap: 20, justifyContent: "flex-end", paddingRight: 8, paddingBottom: 4 }}>
      {items.map((item) => (
        <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", fontWeight: 500 }}>
          <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// Shorten subject name to fit X-axis
function shorten(name = "") {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.length > 7 ? name.slice(0, 6) + "." : name;
  return words.map((w) => w.slice(0, 4)).join(" ");
}

export default function PerformanceChart({ data = [] }) {
  if (!data.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 14 }}>
        No performance data yet.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    shortName: shorten(d.topic),
  }));

  const minWidth = Math.max(520, chartData.length * 160);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: 4 }}>
          Performance Overview
        </p>
        <h3 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Subject performance</h3>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>How your scores compare across this term</p>
      </div>

      {/* Legend */}
      <CustomLegend />

      {/* Chart */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth }}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 16, left: 0, bottom: 4 }}
              barCategoryGap="30%"
              barGap={2}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="shortName"
                tick={{ fontSize: 13, fill: "#374151", fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb", radius: 4 }} />

              <Bar dataKey="my_score"   name="My Score"   fill={MY_SCORE_COLOR}   maxBarSize={40} radius={[6, 6, 0, 0]}>
                <LabelList content={(props) => renderCustomLabel(props, MY_SCORE_COLOR)} />
              </Bar>
              <Bar dataKey="best_score" name="Best Score"  fill={BEST_SCORE_COLOR} maxBarSize={40} radius={[6, 6, 0, 0]}>
                <LabelList content={(props) => renderCustomLabel(props, BEST_SCORE_COLOR)} />
              </Bar>
              <Bar dataKey="class_avg"  name="Class Avg"   fill={CLASS_AVG_COLOR}  maxBarSize={40} radius={[6, 6, 0, 0]}>
                <LabelList content={(props) => renderCustomLabel(props, "#60a5fa")} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
