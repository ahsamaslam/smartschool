import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import learningService from "../../services/learningService";

const RISK_CONFIG = {
  excelling: { color: "#4F46E5", bg: "#EEF2FF", label: "Excelling" },
  stable:    { color: "#059669", bg: "#ECFDF5", label: "Stable" },
  at_risk:   { color: "#D97706", bg: "#FEF3C7", label: "At Risk" },
  critical:  { color: "#DC2626", bg: "#FEF2F2", label: "Critical" },
};

function ProgressBar({ percent, color }) {
  return (
    <View style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" }}>
      <View
        style={{
          height: 6,
          width: `${Math.min(100, Math.max(0, percent ?? 0))}%`,
          backgroundColor: color,
          borderRadius: 3,
        }}
      />
    </View>
  );
}

function SHSCard({ cls }) {
  const risk = RISK_CONFIG[cls.risk_level] ?? RISK_CONFIG.stable;
  const score = cls.shs != null ? Number(cls.shs).toFixed(1) : "—";

  const hwDetail =
    cls.homework?.graded_count > 0 && cls.homework?.total_marks_available > 0
      ? `${Number(cls.homework.marks_earned ?? 0).toFixed(0)}/${Number(cls.homework.total_marks_available ?? 0).toFixed(0)} marks`
      : `${cls.homework?.submitted_count ?? 0}/${cls.homework?.total_homeworks ?? 0} done`;

  const components = [
    {
      label: "Video", weight: "25%",
      rate: cls.video?.rate ?? 0,
      detail: `${cls.video?.watched_count ?? 0}/${cls.video?.total_lectures ?? 0} lectures`,
      color: "#6366F1",
    },
    {
      label: "Attendance", weight: "35%",
      rate: cls.attendance?.rate ?? 0,
      detail: `${cls.attendance?.present_days ?? 0}/${cls.attendance?.total_days ?? 0} days`,
      color: "#10B981",
    },
    {
      label: "Homework", weight: "40%",
      rate: cls.homework?.rate ?? 0,
      detail: hwDetail,
      color: "#7C3AED",
    },
  ];

  const multiBook = (cls.books ?? []).filter((b) => b.total_lectures > 0).length > 1;
  const isAtRisk = cls.risk_level === "critical" || cls.risk_level === "at_risk";
  const tip =
    (cls.video?.rate ?? 0) < (cls.attendance?.rate ?? 0) && (cls.video?.rate ?? 0) < (cls.homework?.rate ?? 0)
      ? "Watch more lectures (≥75%) to boost your Video score."
      : (cls.homework?.rate ?? 0) < (cls.attendance?.rate ?? 0) && (cls.homework?.rate ?? 0) < (cls.video?.rate ?? 0)
      ? "Submit pending homework to raise your score."
      : "Improve your attendance to raise your SHS.";

  return (
    <View style={{
      backgroundColor: risk.bg, borderRadius: 14, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: risk.color + "40",
    }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700", fontSize: 14, color: "#111827" }} numberOfLines={1}>
            {cls.class_name ?? "My Class"}
          </Text>
          {cls.section ? <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{cls.section}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
          <Text style={{ fontSize: 30, fontWeight: "900", color: risk.color, lineHeight: 34 }}>{score}</Text>
          <Text style={{ fontSize: 10, fontWeight: "700", color: risk.color, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {risk.label}
          </Text>
        </View>
      </View>

      {/* Component bars */}
      {components.map((c) => (
        <View key={c.label} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text style={{ fontSize: 11, color: "#6B7280" }}>
              {c.label} <Text style={{ color: "#9CA3AF" }}>({c.weight})</Text>
            </Text>
            <Text style={{ fontSize: 11, color: "#6B7280" }}>
              {c.detail} · {Math.round(c.rate)}%
            </Text>
          </View>
          <ProgressBar percent={c.rate} color={c.color} />
        </View>
      ))}

      {/* Per-subject video breakdown */}
      {multiBook && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#ffffff80" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#374151", marginBottom: 6 }}>Video by Subject</Text>
          {(cls.books ?? []).filter((b) => b.total_lectures > 0).map((b, i) => {
            const barColor = b.video_rate >= 75 ? "#6366F1" : b.video_rate >= 40 ? "#F59E0B" : "#EF4444";
            return (
              <View key={i} style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontSize: 11, color: "#6B7280", flex: 1 }} numberOfLines={1}>{b.subject_name}</Text>
                  <Text style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>
                    {b.watched_count}/{b.total_lectures} · {Number(b.video_rate ?? 0).toFixed(0)}%
                  </Text>
                </View>
                <ProgressBar percent={b.video_rate ?? 0} color={barColor} />
              </View>
            );
          })}
        </View>
      )}

      {/* At-risk tip */}
      {isAtRisk && (
        <View style={{ marginTop: 10, backgroundColor: "#ffffff99", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ fontSize: 11, color: "#92400E" }}>⚠ {tip}</Text>
        </View>
      )}
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const [shsData, setShsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const { data } = await learningService.getDashboardSummary();
      setSummary(data);
    } catch (e) {
      console.warn("Dashboard summary failed:", e?.response?.status, e?.message);
    }
    try {
      const { data } = await learningService.getSHS();
      console.log("SHS response:", JSON.stringify(data));
      setShsData(Array.isArray(data) ? data : data ? [data] : []);
    } catch (e) {
      console.warn("SHS fetch failed:", e?.response?.status, e?.message);
    }
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={{ backgroundColor: "#4F46E5", padding: 24, paddingTop: 56 }}>
        <Text style={{ color: "#C7D2FE", fontSize: 14, marginBottom: 4 }}>Welcome back,</Text>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }} numberOfLines={1}>
          {user?.name ?? user?.email}
        </Text>
      </View>

      <View style={{ padding: 16 }}>
        {/* Stat pills */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <StatPill label="Topics Done" value={summary?.topics_completed ?? 0} color="#10B981" />
          <StatPill label="Upcoming Exams" value={summary?.exams_upcoming ?? 0} color="#EF4444" />
          <StatPill label="Completed Exams" value={summary?.exams_completed ?? 0} color="#6366F1" />
        </View>

        {/* SHS Section */}
        {shsData.length > 0 ? (
          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Student Health Score (SHS)
              </Text>
            </View>
            {shsData.map((cls, i) => (
              <SHSCard key={cls.class_id ?? i} cls={cls} />
            ))}
          </View>
        ) : (
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, alignItems: "center" }}>
            <Text style={{ color: "#9CA3AF", fontSize: 13 }}>Student Health Score unavailable</Text>
          </View>
        )}

        {/* Recent Topics */}
        {(summary?.recent_topics ?? []).length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Recently Studied
            </Text>
            {(summary.recent_topics).slice(0, 3).map((t) => (
              <View key={t.topic_id} style={{
                backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8,
                flexDirection: "row", alignItems: "center",
                shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
              }}>
                <Text style={{ fontSize: 16, marginRight: 10 }}>{t.topic_completed ? "✅" : "📖"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "500", color: "#111827", fontSize: 13 }} numberOfLines={1}>{t.title}</Text>
                  <Text style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>
                    {t.lecture_watch_percent > 0 ? `${Math.round(t.lecture_watch_percent)}% watched` : "Not started"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Quick Actions
        </Text>
        <QuickAction label="My Courses" description="Browse subjects and topics" onPress={() => navigation.navigate("CoursesTab")} color="#4F46E5" />
        <QuickAction label="Homework" description="View pending assignments" onPress={() => navigation.navigate("HomeworkTab")} color="#F59E0B" />
        <QuickAction label="Messages" description="Chat with teachers" onPress={() => navigation.navigate("ChatTab")} color="#10B981" />
        <QuickAction label="Profile" description="View and edit your profile" onPress={() => navigation.navigate("MoreTab", { screen: "Profile" })} color="#6366F1" />
      </View>

      {/* Logout */}
      <View style={{ padding: 16, paddingBottom: 40 }}>
        <TouchableOpacity
          onPress={logout}
          style={{ borderWidth: 1, borderColor: "#EF4444", borderRadius: 8, paddingVertical: 12, alignItems: "center" }}
        >
          <Text style={{ color: "#EF4444", fontWeight: "600" }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function StatPill({ label, value, color }) {
  return (
    <View style={{
      flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12,
      alignItems: "center", borderTopWidth: 3, borderTopColor: color,
      shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ color: "#6B7280", fontSize: 10, marginTop: 3, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

function QuickAction({ label, description, onPress, color }) {
  return (
    <TouchableOpacity onPress={onPress} style={{
      backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10,
      flexDirection: "row", alignItems: "center",
      shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 22, backgroundColor: color + "20",
        justifyContent: "center", alignItems: "center", marginRight: 12,
      }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600", color: "#111827", fontSize: 15 }}>{label}</Text>
        <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>{description}</Text>
      </View>
      <Text style={{ color: "#9CA3AF", fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}
