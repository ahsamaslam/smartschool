import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useChatContext } from "../../context/ChatContext";
import chatService from "../../services/chatService";

export default function ConversationsScreen({ navigation }) {
  const { incomingMessage, setUnreadCount } = useChatContext();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = async () => {
    try {
      const { data } = await chatService.listConversations();
      // Backend returns { data: [...], page, total } — not { conversations: [...] }
      setConversations(data.data ?? data.conversations ?? []);
    } catch {
      setConversations([]);
    }
  };

  // Refresh list when screen is focused
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchConversations().finally(() => setLoading(false));
      setUnreadCount(0);
    }, []),
  );

  // Refresh when new message arrives
  useEffect(() => {
    if (incomingMessage) {
      fetchConversations();
    }
  }, [incomingMessage]);

  if (loading && conversations.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* New Message Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("NewChat")}
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          zIndex: 10,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#4F46E5",
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#4F46E5",
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 26, marginTop: -2 }}>+</Text>
      </TouchableOpacity>

      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.id ?? item.conversation_id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchConversations();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 2 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
            <Text style={{ color: "#6B7280", fontSize: 16 }}>
              No conversations yet.
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 14, marginTop: 4 }}>
              Tap + to start a new message.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const name =
            item.full_name ??
            item.other_participant_name ??
            item.recipient_name ??
            item.name ??
            "Unknown";
          // Backend returns last_message_preview at top level, not last_message.content
          const lastMsg =
            item.last_message_preview ?? item.last_message?.content ?? "";
          const unread = item.unread_count ?? 0;
          const rawTime = item.last_message_at ?? item.last_message?.created_at;
          const time = rawTime
            ? new Date(rawTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          return (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("Chat", {
                  conversationId: item.id ?? item.conversation_id,
                  recipientName: name,
                })
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 14,
                marginBottom: 4,
              }}
            >
              {/* Avatar */}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "#EEF2FF",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <Text
                  style={{ fontWeight: "bold", color: "#4F46E5", fontSize: 18 }}
                >
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600", color: "#111827" }}>
                  {name}
                </Text>
                <Text
                  style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}
                  numberOfLines={1}
                >
                  {lastMsg || "No messages yet"}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                {time ? (
                  <Text
                    style={{ color: "#9CA3AF", fontSize: 11, marginBottom: 4 }}
                  >
                    {time}
                  </Text>
                ) : null}
                {unread > 0 && (
                  <View
                    style={{
                      backgroundColor: "#4F46E5",
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      justifyContent: "center",
                      alignItems: "center",
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: "bold",
                      }}
                    >
                      {unread}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
