import { useEffect, useState } from "react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/solid";

export function SHSTrendChart({ data, loading = false }) {
  /**
   * SHS trend over 30 days with momentum indicator
   * data: [{ date, shs, risk_level }, ...]
   */
  if (loading) {
    return (
      <div className="h-80 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-center">
        <div className="text-gray-500">Loading chart...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-center">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    shs: parseFloat(d.shs),
    risk: d.risk_level,
  }));

  // Calculate trend: is last point higher than first?
  const trend = chartData[chartData.length - 1]?.shs > chartData[0]?.shs ? "up" : "down";
  const trendPercent = (
    ((chartData[chartData.length - 1]?.shs - chartData[0]?.shs) / chartData[0]?.shs) * 100
  ).toFixed(1);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const riskColors = {
        critical: "text-red-600",
        at_risk: "text-amber-600",
        stable: "text-green-600",
        excelling: "text-blue-600",
      };
      return (
        <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-lg">
          <p className="text-sm font-semibold text-gray-900">{point.date}</p>
          <p className={`text-lg font-bold ${riskColors[point.risk] || "text-gray-600"}`}>
            {point.shs.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500 capitalize">{point.risk}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">SHS Trend (30 Days)</h3>
          <p className="text-sm text-gray-500 mt-1">Student Health Score progression</p>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
          trend === "up" ? "bg-green-50" : "bg-red-50"
        }`}>
          {trend === "up" ? (
            <ArrowUpIcon className="h-4 w-4 text-green-600" />
          ) : (
            <ArrowDownIcon className="h-4 w-4 text-red-600" />
          )}
          <span className={`text-sm font-semibold ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
            {trendPercent > 0 ? "+" : ""}{trendPercent}%
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorSHS" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#9ca3af"
            style={{ fontSize: "12px" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="shs"
            stroke="#4f46e5"
            fillOpacity={1}
            fill="url(#colorSHS)"
            name="SHS Score"
            strokeWidth={2}
          />
          {/* Risk level reference lines */}
          <line x1="0" y1="40" x2="100%" stroke="#dc2626" strokeDasharray="5" opacity={0.3} />
          <line x1="0" y1="60" x2="100%" stroke="#ea580c" strokeDasharray="5" opacity={0.3} />
          <line x1="0" y1="80" x2="100%" stroke="#16a34a" strokeDasharray="5" opacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Risk level legend */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-red-600"></div>
          <span className="text-gray-600">Critical &lt; 40</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-amber-600"></div>
          <span className="text-gray-600">At-Risk 40-59</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-green-600"></div>
          <span className="text-gray-600">Stable 60-79</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-blue-600"></div>
          <span className="text-gray-600">Excelling ≥ 80</span>
        </div>
      </div>
    </div>
  );
}

export function ComponentBreakdownChart({ data, loading = false }) {
  /**
   * Stacked area chart showing contribution of each SHS component over time
   * data: [{ date, video_rate, homework_rate, consistency, behavioral }, ...]
   */
  if (loading || !data || data.length === 0) {
    return (
      <div className="h-80 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-center">
        <div className="text-gray-500">Loading breakdown...</div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    video: parseFloat(d.video_rate * 0.25), // Weighted contribution
    homework: parseFloat(d.homework_rate * 0.40),
    consistency: parseFloat(d.consistency * 0.20),
    behavioral: parseFloat(d.behavioral * 0.15),
  }));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">SHS Component Breakdown</h3>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#9ca3af"
            style={{ fontSize: "12px" }}
          />
          <Tooltip formatter={(value) => value.toFixed(1)} />
          <Legend />
          <Area
            type="monotone"
            dataKey="video"
            stackId="1"
            stroke="none"
            fill="#6366f1"
            name="Video (25%)"
            opacity={0.8}
          />
          <Area
            type="monotone"
            dataKey="homework"
            stackId="1"
            stroke="none"
            fill="#a855f7"
            name="Homework (40%)"
            opacity={0.8}
          />
          <Area
            type="monotone"
            dataKey="consistency"
            stackId="1"
            stroke="none"
            fill="#06b6d4"
            name="Consistency (20%)"
            opacity={0.8}
          />
          <Area
            type="monotone"
            dataKey="behavioral"
            stackId="1"
            stroke="none"
            fill="#f97316"
            name="Behavioral (15%)"
            opacity={0.8}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MomentumIndicator({ momentum, risk_level }) {
  /**
   * Visual momentum indicator
   * momentum: number (% change week-over-week)
   * risk_level: 'critical' | 'at_risk' | 'stable' | 'excelling'
   */
  const isPositive = momentum >= 0;
  const riskColors = {
    critical: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    at_risk: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    stable: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    excelling: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  };

  const colors = riskColors[risk_level] || riskColors.stable;

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-semibold ${colors.text}`}>Week-over-Week Momentum</p>
          <p className="text-xs text-gray-500 mt-1">Trend comparison with previous week</p>
        </div>
        <div className="flex items-center gap-2">
          {isPositive ? (
            <ArrowUpIcon className={`h-6 w-6 ${colors.text}`} />
          ) : (
            <ArrowDownIcon className={`h-6 w-6 ${colors.text}`} />
          )}
          <span className={`text-3xl font-black ${colors.text}`}>
            {momentum >= 0 ? "+" : ""}{momentum.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Interpretation */}
      <div className="mt-4 text-xs text-gray-600">
        {momentum > 15 && "✅ Strong improvement! Student is making great progress."}
        {momentum >= 0 && momentum <= 15 && "📈 Slight improvement. Keep up the efforts."}
        {momentum < 0 && momentum >= -15 && "📉 Slight decline. Needs attention."}
        {momentum < -15 && "🔴 Rapid decline! Immediate intervention needed."}
      </div>
    </div>
  );
}
