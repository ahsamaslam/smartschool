import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import studentService from "../../services/studentService";

export default function SubjectScreen({ route, navigation }) {
  const { subjectId, subjectName } = route.params;
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTopics = async () => {
    try {
      const { data } = await studentService.getSubjectTopics(
        subjectId,
        user.id,
      );
      setTopics(data);
    } catch {
      setTopics([]);
    }
  };

  useEffect(() => {
    fetchTopics().finally(() => setLoading(false));
  }, [subjectId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <FlatList
      data={topics}
      keyExtractor={(item) => String(item.topic_id ?? item.id)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchTopics();
            setRefreshing(false);
          }}
        />
      }
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={
        <View style={{ alignItems: "center", marginTop: 64 }}>
          <Text style={{ color: "#6B7280" }}>No topics found.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isLocked = item.locked ?? false;
        return (
          <TouchableOpacity
            disabled={isLocked}
            onPress={() =>
              navigation.navigate("TopicLearn", {
                topicId: item.topic_id ?? item.id,
                topicName: item.topic_name ?? item.name,
              })
            }
            style={{
              backgroundColor: isLocked ? "#F3F4F6" : "#fff",
              borderRadius: 12,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              shadowColor: "#000",
              shadowOpacity: isLocked ? 0 : 0.06,
              shadowRadius: 4,
              elevation: isLocked ? 0 : 2,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: isLocked ? "#E5E7EB" : "#EEF2FF",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              <Text style={{ fontSize: 16 }}>{isLocked ? "🔒" : "📝"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontWeight: "600",
                  color: isLocked ? "#9CA3AF" : "#111827",
                }}
              >
                {item.topic_name ?? item.name}
              </Text>
              {item.progress != null && (
                <View style={{ marginTop: 6 }}>
                  <View
                    style={{
                      height: 4,
                      backgroundColor: "#E5E7EB",
                      borderRadius: 2,
                    }}
                  >
                    <View
                      style={{
                        height: 4,
                        width: `${item.progress}%`,
                        backgroundColor: "#4F46E5",
                        borderRadius: 2,
                      }}
                    />
                  </View>
                  <Text
                    style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}
                  >
                    {item.progress}% complete
                  </Text>
                </View>
              )}
            </View>
            {!isLocked && (
              <Text style={{ color: "#9CA3AF", fontSize: 20 }}>›</Text>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}
