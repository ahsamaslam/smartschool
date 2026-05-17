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
  upcoming: { bg: "#EEF2FF", text: "#4F46E5" },
  in_progress: { bg: "#FEF3C7", text: "#D97706" },
  completed: { bg: "#ECFDF5", text: "#059669" },
  missed: { bg: "#FEF2F2", text: "#DC2626" },
};

export default function ExamsScreen() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchExams = async () => {
    try {
      const { data } = await examService.getGroupedExams();
      // data: { upcoming: [], in_progress: [], completed: [] }
      const built = [];
      if (data.in_progress?.length)
        built.push({ title: "In Progress", data: data.in_progress });
      if (data.upcoming?.length)
        built.push({ title: "Upcoming", data: data.upcoming });
      if (data.completed?.length)
        built.push({ title: "Completed", data: data.completed });
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
      keyExtractor={(item) => String(item.exam_id ?? item.id)}
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
      contentContainerStyle={{ padding: 16, gap: 8 }}
      ListEmptyComponent={
        <View style={{ alignItems: "center", marginTop: 64 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📅</Text>
          <Text style={{ color: "#6B7280", fontSize: 16 }}>
            No exams scheduled.
          </Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text
          style={{
            fontWeight: "700",
            color: "#374151",
            fontSize: 15,
            marginTop: 12,
            marginBottom: 6,
          }}
        >
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => {
        const status = item.status ?? "upcoming";
        const style = STATUS_STYLE[status] ?? STATUS_STYLE.upcoming;
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
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <Text
                style={{ fontWeight: "600", color: "#111827", flex: 1 }}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <View
                style={{
                  backgroundColor: style.bg,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                  marginLeft: 8,
                }}
              >
                <Text
                  style={{
                    color: style.text,
                    fontSize: 11,
                    fontWeight: "600",
                    textTransform: "capitalize",
                  }}
                >
                  {status.replace("_", " ")}
                </Text>
              </View>
            </View>
            {item.subject_name && (
              <Text style={{ color: "#6B7280", fontSize: 13 }}>
                {item.subject_name}
              </Text>
            )}
            {item.scheduled_at && (
              <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
                {new Date(item.scheduled_at).toLocaleString()}
              </Text>
            )}
            {item.score != null && (
              <Text
                style={{ color: "#4F46E5", fontWeight: "600", marginTop: 4 }}
              >
                Score: {item.score} / {item.total_marks ?? "—"}
              </Text>
            )}
          </View>
        );
      }}
    />
  );
}
