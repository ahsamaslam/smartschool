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

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async () => {
    try {
      const { data } = await learningService.getDashboardSummary();
      setSummary(data);
    } catch {
      // Best-effort
    }
  };

  useEffect(() => {
    fetchSummary().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: "#4F46E5",
          padding: 24,
          paddingTop: 56,
        }}
      >
        <Text style={{ color: "#C7D2FE", fontSize: 14, marginBottom: 4 }}>
          Welcome back,
        </Text>
        <Text
          style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }}
          numberOfLines={1}
        >
          {user?.name ?? user?.email}
        </Text>
      </View>

      {/* Quick Stats */}
      {summary && (
        <View style={{ padding: 16, gap: 12 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 4,
            }}
          >
            Overview
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              label="Subjects"
              value={summary.total_subjects ?? 0}
              color="#4F46E5"
            />
            <StatCard
              label="Completed"
              value={summary.topics_completed ?? 0}
              color="#10B981"
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              label="Pending HW"
              value={summary.pending_homework ?? 0}
              color="#F59E0B"
            />
            <StatCard
              label="Exams"
              value={summary.upcoming_exams ?? 0}
              color="#EF4444"
            />
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827" }}>
          Quick Actions
        </Text>
        <QuickAction
          label="My Courses"
          description="Browse subjects and topics"
          onPress={() => navigation.navigate("CoursesTab")}
          color="#4F46E5"
        />
        <QuickAction
          label="Homework"
          description="View pending assignments"
          onPress={() => navigation.navigate("HomeworkTab")}
          color="#F59E0B"
        />
        <QuickAction
          label="Messages"
          description="Chat with teachers"
          onPress={() => navigation.navigate("ChatTab")}
          color="#10B981"
        />
        <QuickAction
          label="Profile"
          description="View and edit your profile"
          onPress={() => navigation.navigate("MoreTab")}
          color="#6366F1"
        />
      </View>

      {/* Logout */}
      <View style={{ padding: 16, paddingBottom: 40 }}>
        <TouchableOpacity
          onPress={logout}
          style={{
            borderWidth: 1,
            borderColor: "#EF4444",
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#EF4444", fontWeight: "600" }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        borderLeftWidth: 4,
        borderLeftColor: color,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "bold", color }}>{value}</Text>
      <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}

function QuickAction({ label, description, onPress, color }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: color + "20",
          justifyContent: "center",
          alignItems: "center",
          marginRight: 12,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: color,
          }}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600", color: "#111827", fontSize: 15 }}>
          {label}
        </Text>
        <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>
          {description}
        </Text>
      </View>
      <Text style={{ color: "#9CA3AF", fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}
