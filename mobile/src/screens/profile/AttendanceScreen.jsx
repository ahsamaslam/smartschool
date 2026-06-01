import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ScrollView as HScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";

const SCREEN_W = Dimensions.get("window").width;
import { useAuth } from "../../context/AuthContext";
import studentService from "../../services/studentService";

const CHART_HEIGHT = 150;
const Y_AXIS_W = 34;
const BAR_W = 32;
const BAR_GAP = 24;
const Y_LABELS = [0, 20, 40, 60, 80, 100];

function VerticalBarChart({ data }) {
  if (!data || data.length === 0) return null;

  const colW = BAR_W + BAR_GAP;
  const chartW = Math.max(data.length * colW + BAR_GAP, SCREEN_W - 64 - Y_AXIS_W);

  return (
    <View>
      {/* Legend */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <View style={{ width: 12, height: 12, backgroundColor: "#BE185D", borderRadius: 2, marginRight: 6 }} />
        <Text style={{ fontSize: 11, color: "#6B7280" }}>Attendance in %</Text>
      </View>

      <View style={{ flexDirection: "row", height: CHART_HEIGHT }}>
        {/* Y-axis */}
        <View style={{ width: Y_AXIS_W, height: CHART_HEIGHT, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 4 }}>
          {[...Y_LABELS].reverse().map((l) => (
            <Text key={l} style={{ fontSize: 9, color: "#9CA3AF", lineHeight: 12 }}>{l}%</Text>
          ))}
        </View>

        {/* Scrollable bars only */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ width: chartW, height: CHART_HEIGHT, position: "relative" }}>
            {/* Horizontal grid lines */}
            {Y_LABELS.map((l) => (
              <View
                key={l}
                style={{
                  position: "absolute",
                  left: 0, right: 0,
                  top: CHART_HEIGHT - (l / 100) * CHART_HEIGHT - 1,
                  height: 1,
                  backgroundColor: l === 0 ? "#CBD5E1" : "#F1F5F9",
                }}
              />
            ))}
            {/* 75% threshold line */}
            <View
              style={{
                position: "absolute",
                left: 0, right: 0,
                top: CHART_HEIGHT - 0.75 * CHART_HEIGHT - 1,
                height: 1.5,
                backgroundColor: "#F59E0B",
              }}
            />
            {/* Bars */}
            <View style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT, paddingHorizontal: BAR_GAP / 2 }}>
              {data.map((item, i) => {
                const pct = Math.min(100, Math.max(0, Number(item.attendance_percent ?? 0)));
                const barH = Math.max(2, (pct / 100) * CHART_HEIGHT);
                return (
                  <View
                    key={i}
                    style={{ width: colW, alignItems: "center", justifyContent: "flex-end", height: CHART_HEIGHT }}
                  >
                    <View
                      style={{
                        width: BAR_W,
                        height: barH,
                        backgroundColor: "#BE185D",
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                      }}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* X-axis labels — outside the fixed-height row so they're never clipped */}
      <View style={{ flexDirection: "row", marginLeft: Y_AXIS_W, paddingHorizontal: BAR_GAP / 2, marginTop: 8 }}>
        {data.map((item, i) => (
          <View key={i} style={{ width: colW, alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: "#374151", textAlign: "center", fontWeight: "500" }} numberOfLines={2}>
              {item.course || item.subject_name || item.class_name}
            </Text>
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 10 }}>
        — Yellow line = 75% minimum threshold
      </Text>
    </View>
  );
}

export default function AttendanceScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAttendance = async () => {
    try {
      const { data: res } = await studentService.getAttendanceSummary(user.id);
      setData(res);
    } catch {
      setData(null);
    }
  };

  useEffect(() => {
    fetchAttendance().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" }}>
        <Text style={{ color: "#9CA3AF", fontSize: 15 }}>No attendance data found.</Text>
      </View>
    );
  }

  const overall = data.overall ?? {};
  const courses = data.courses ?? [];
  const graph = data.graph ?? [];
  const overallPct = Math.round(overall.attendance_percent ?? 0);
  const overallColor = overallPct >= 75 ? "#059669" : overallPct >= 50 ? "#D97706" : "#DC2626";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchAttendance();
            setRefreshing(false);
          }}
        />
      }
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {/* Overall summary cards */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <SummaryCard label="Present" value={overall.present_days ?? 0} color="#059669" />
        <SummaryCard label="Absent" value={(overall.total_days ?? 0) - (overall.present_days ?? 0)} color="#DC2626" />
        <SummaryCard label="Overall" value={`${overallPct}%`} color={overallColor} />
      </View>

      {/* Attendance by Subject — Bar Chart */}
      {graph.length > 0 && (
        <View style={{
          backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16,
          shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        }}>
          <Text style={{ fontWeight: "700", fontSize: 14, color: "#111827", marginBottom: 12 }}>
            Attendance by Subject
          </Text>
          <VerticalBarChart data={graph} />
        </View>
      )}

      {/* Detailed table by teacher */}
      {courses.length > 0 && (
        <View style={{
          backgroundColor: "#fff", borderRadius: 12, padding: 16,
          shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        }}>
          <Text style={{ fontWeight: "700", fontSize: 14, color: "#111827", marginBottom: 12 }}>
            By Teacher
          </Text>

          {/* Table header */}
          <View style={{
            flexDirection: "row", paddingBottom: 8, marginBottom: 4,
            borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
          }}>
            <Text style={{ flex: 2, fontSize: 11, fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase" }}>Subject / Teacher</Text>
            <Text style={{ width: 40, fontSize: 11, fontWeight: "600", color: "#9CA3AF", textAlign: "center" }}>P</Text>
            <Text style={{ width: 40, fontSize: 11, fontWeight: "600", color: "#9CA3AF", textAlign: "center" }}>A</Text>
            <Text style={{ width: 50, fontSize: 11, fontWeight: "600", color: "#9CA3AF", textAlign: "right" }}>%</Text>
          </View>

          {courses.map((c, i) => {
            const pct = Math.round(c.attendance_percent ?? 0);
            const pctColor = pct >= 75 ? "#059669" : pct >= 50 ? "#D97706" : "#DC2626";
            return (
              <View
                key={i}
                style={{
                  flexDirection: "row", alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: i < courses.length - 1 ? 1 : 0,
                  borderBottomColor: "#F9FAFB",
                }}
              >
                <View style={{ flex: 2 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#111827" }} numberOfLines={1}>
                    {c.subject_name || c.class_name}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }} numberOfLines={1}>
                    {c.teacher_name}
                  </Text>
                </View>
                <Text style={{ width: 40, fontSize: 13, color: "#059669", fontWeight: "600", textAlign: "center" }}>
                  {c.present_days ?? 0}
                </Text>
                <Text style={{ width: 40, fontSize: 13, color: "#DC2626", fontWeight: "600", textAlign: "center" }}>
                  {c.absent_days ?? 0}
                </Text>
                <Text style={{ width: 50, fontSize: 13, fontWeight: "700", color: pctColor, textAlign: "right" }}>
                  {pct}%
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <View style={{
      flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 14,
      alignItems: "center", borderTopWidth: 3, borderTopColor: color,
      shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ color: "#6B7280", fontSize: 11, marginTop: 3 }}>{label}</Text>
    </View>
  );
}
