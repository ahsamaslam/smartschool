import { useEffect, useState } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import examService from "../../services/examService";

const STATUS_STYLE = {
  upcoming:    { bg: "#EEF2FF", text: "#4F46E5" },
  scheduled:   { bg: "#EEF2FF", text: "#4F46E5" },
  in_progress: { bg: "#FEF3C7", text: "#D97706" },
  active:      { bg: "#FEF3C7", text: "#D97706" },
  started:     { bg: "#FEF3C7", text: "#D97706" },
  completed:   { bg: "#ECFDF5", text: "#059669" },
  submitted:   { bg: "#ECFDF5", text: "#059669" },
  finalized:   { bg: "#ECFDF5", text: "#059669" },
  graded:      { bg: "#ECFDF5", text: "#059669" },
  missed:      { bg: "#FEF2F2", text: "#DC2626" },
  cancelled:   { bg: "#F3F4F6", text: "#6B7280" },
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  // timeStr is "HH:MM" or "HH:MM:SS"
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setHours(parseInt(h, 10), parseInt(m, 10), 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function parseFormat(rawFormat) {
  if (!rawFormat) return null;
  try {
    const obj = typeof rawFormat === "string" ? JSON.parse(rawFormat) : rawFormat;
    return Object.entries(obj)
      .map(([type, count]) => `${count} ${type.toUpperCase()}`)
      .join(", ");
  } catch {
    return null;
  }
}

export default function ExamsScreen() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchExams = async () => {
    try {
      const { data } = await examService.getMyScheduledExams();
      // API returns { today: [], upcoming: [], past: [] }
      const ACTIVE = new Set(["active", "started", "in_progress"]);
      const allToday    = data.today    ?? [];
      const allUpcoming = data.upcoming ?? [];
      const allPast     = data.past     ?? [];

      // Pull any active/started exams into their own "In Progress" section
      const inProgress = [
        ...allToday.filter((e) => ACTIVE.has(e.status)),
        ...allUpcoming.filter((e) => ACTIVE.has(e.status)),
      ];
      const today    = allToday.filter((e) => !ACTIVE.has(e.status));
      const upcoming = allUpcoming.filter((e) => !ACTIVE.has(e.status));

      const built = [];
      if (inProgress.length) built.push({ title: "In Progress", data: inProgress });
      if (today.length)      built.push({ title: "Today", data: today });
      if (upcoming.length)   built.push({ title: "Upcoming", data: upcoming });
      if (allPast.length)    built.push({ title: "Past", data: allPast });
      setSections(built);
    } catch {
      setSections([]);
    }
  };

  useEffect(() => {
    fetchExams().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => String(item.id ?? item.exam_id)}
      style={{ backgroundColor: "#F9FAFB" }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchExams();
            setRefreshing(false);
          }}
        />
      }
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ListEmptyComponent={
        <View style={{ alignItems: "center", marginTop: 64 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
          <Text style={{ color: "#6B7280", fontSize: 16 }}>No exams scheduled.</Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          {section.title === "In Progress" && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#D97706",
                marginRight: 8,
              }}
            />
          )}
          <Text
            style={{
              fontWeight: "700",
              color: section.title === "In Progress" ? "#D97706" : "#374151",
              fontSize: 15,
            }}
          >
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item }) => {
        const status = item.status ?? "upcoming";
        const style = STATUS_STYLE[status] ?? STATUS_STYLE.upcoming;
        const dateStr = formatDate(item.exam_date);
        const timeStr = formatTime(item.exam_time);
        const formatStr = parseFormat(item.exam_format);
        const hasScore = item.score != null && item.total_marks != null;

        return (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 16,
              marginBottom: 10,
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            {/* Title + Status badge */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text
                style={{ fontWeight: "700", color: "#111827", flex: 1, fontSize: 15, lineHeight: 20 }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <View
                style={{
                  backgroundColor: style.bg,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 12,
                  marginLeft: 8,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: style.text, fontSize: 11, fontWeight: "600", textTransform: "capitalize" }}>
                  {status.replace("_", " ")}
                </Text>
              </View>
            </View>

            {/* Subject · Class */}
            {(item.subject_name || item.class_name) && (
              <Text style={{ color: "#4F46E5", fontSize: 13, fontWeight: "500", marginBottom: 6 }}>
                {[item.subject_name, item.class_name].filter(Boolean).join("  ·  ")}
              </Text>
            )}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: "#F3F4F6", marginBottom: 8 }} />

            {/* Date & Time */}
            {(dateStr || timeStr) && (
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ color: "#6B7280", fontSize: 12, width: 18 }}>📅</Text>
                <Text style={{ color: "#374151", fontSize: 13 }}>
                  {[dateStr, timeStr].filter(Boolean).join("  ·  ")}
                </Text>
              </View>
            )}

            {/* Teacher */}
            {item.teacher_name && (
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ color: "#6B7280", fontSize: 12, width: 18 }}>👤</Text>
                <Text style={{ color: "#374151", fontSize: 13 }}>{item.teacher_name}</Text>
              </View>
            )}

            {/* Format & Questions */}
            {(formatStr || item.question_count > 0) && (
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ color: "#6B7280", fontSize: 12, width: 18 }}>📝</Text>
                <Text style={{ color: "#374151", fontSize: 13 }}>
                  {formatStr ?? `${item.question_count} questions`}
                  {item.total_marks > 0 ? `  ·  ${item.total_marks} marks` : ""}
                </Text>
              </View>
            )}

            {/* Score (past exams) */}
            {hasScore && (
              <View
                style={{
                  marginTop: 8,
                  backgroundColor: "#ECFDF5",
                  borderRadius: 8,
                  padding: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#059669", fontWeight: "700", fontSize: 15 }}>
                  Score: {item.score} / {item.total_marks}
                </Text>
                {item.total_marks > 0 && (
                  <Text style={{ color: "#059669", fontSize: 13 }}>
                    {Math.round((item.score / item.total_marks) * 100)}%
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      }}
    />
  );
}
