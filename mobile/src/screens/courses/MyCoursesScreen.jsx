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
import learningService from "../../services/learningService";

export default function MyCoursesScreen({ navigation }) {
  const { user } = useAuth();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTree = async () => {
    try {
      const { data } = await learningService.getLearningTree();
      setTree(data);
    } catch {
      setTree([]);
    }
  };

  useEffect(() => {
    fetchTree().finally(() => setLoading(false));
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
      data={tree}
      keyExtractor={(item) => String(item.subject_id ?? item.id)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchTree();
            setRefreshing(false);
          }}
        />
      }
      contentContainerStyle={{ padding: 16, gap: 12 }}
      ListEmptyComponent={
        <View style={{ alignItems: "center", marginTop: 64 }}>
          <Text style={{ color: "#6B7280", fontSize: 16 }}>
            No subjects enrolled yet.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("Subject", {
              subjectId: item.subject_id ?? item.id,
              subjectName: item.subject_name ?? item.name,
            })
          }
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: "#EEF2FF",
              justifyContent: "center",
              alignItems: "center",
              marginRight: 12,
            }}
          >
            <Text style={{ fontSize: 20 }}>📚</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600", fontSize: 16, color: "#111827" }}>
              {item.subject_name ?? item.name}
            </Text>
            {item.topics_count != null && (
              <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>
                {item.topics_count} topics
              </Text>
            )}
          </View>
          <Text style={{ color: "#9CA3AF", fontSize: 20 }}>›</Text>
        </TouchableOpacity>
      )}
    />
  );
}
