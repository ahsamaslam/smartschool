import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import homeworkService from "../../services/homeworkService";

const STATUS_COLORS = {
  pending: "#F59E0B",
  submitted: "#10B981",
  graded: "#4F46E5",
  reviewed: "#4F46E5",
  returned: "#4F46E5",
  overdue: "#EF4444",
  overdue_not_submitted: "#EF4444",
  late_open: "#F59E0B",
  in_progress: "#F59E0B",
  submitted_awaiting: "#10B981",
  late_awaiting: "#10B981",
  missing: "#EF4444",
};

export default function HomeworkListScreen({ navigation }) {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchList = async () => {
    try {
      const { data } = await homeworkService.studentList();
      // API returns { data: [...], summary: {...} } or a flat array
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      setHomework(list);
    } catch {
      setHomework([]);
    }
  };

  useEffect(() => {
    fetchList().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <FlatList
      data={homework}
      keyExtractor={(item) => String(item.id ?? item.homework_id)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchList();
            setRefreshing(false);
          }}
        />
      }
      contentContainerStyle={{ padding: 16, gap: 12 }}
      ListEmptyComponent={
        <View style={{ alignItems: "center", marginTop: 64 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
          <Text style={{ color: "#6B7280", fontSize: 16 }}>
            No homework assigned.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const status = item.ui_bucket ?? item.submission_status ?? item.status ?? "pending";
        const color = STATUS_COLORS[status] ?? "#9CA3AF";
        return (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("HomeworkDetail", {
                homeworkId: item.id ?? item.homework_id,
                title: item.title,
              })
            }
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 16,
              borderLeftWidth: 4,
              borderLeftColor: color,
              shadowColor: "#000",
              shadowOpacity: 0.06,
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
                style={{
                  fontWeight: "600",
                  color: "#111827",
                  fontSize: 15,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <View
                style={{
                  backgroundColor: color + "20",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                  marginLeft: 8,
                }}
              >
                <Text
                  style={{
                    color,
                    fontSize: 11,
                    fontWeight: "600",
                    textTransform: "capitalize",
                  }}
                >
                  {status}
                </Text>
              </View>
            </View>
            {item.subject_name && (
              <Text style={{ color: "#6B7280", fontSize: 13 }}>
                {item.subject_name}
              </Text>
            )}
            {(item.due_at ?? item.due_date) && (
              <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>
                Due: {new Date(item.due_at ?? item.due_date).toLocaleDateString()}
              </Text>
            )}
            {item.marks_awarded != null && (
              <Text style={{ color: "#10B981", fontSize: 12, marginTop: 2 }}>
                Grade: {item.marks_awarded}/{item.total_marks}
              </Text>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}
