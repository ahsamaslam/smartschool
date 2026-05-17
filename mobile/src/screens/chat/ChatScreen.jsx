import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  AppState,
  StatusBar,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../context/AuthContext";
import { useChatContext } from "../../context/ChatContext";
import chatService from "../../services/chatService";

export default function ChatScreen({ route }) {
  const { conversationId, recipientName } = route.params ?? {};
  const { user } = useAuth();
  const {
    incomingMessage,
    typingState,
    sendTypingStart,
    sendTypingStop,
    markMessageRead,
    wsConnected,
  } = useChatContext();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const flatListRef = useRef(null);
  const typingTimer = useRef(null);
  // Track seen message IDs to prevent REST+socket duplicates
  const seenIdsRef = useRef(new Set());

  const fetchMessages = useCallback(
    async (p = 1) => {
      try {
        const { data } = await chatService.getMessages(conversationId, p);
        // Backend returns { data: [...], page } — not { messages: [...] }
        const msgs = data.data ?? data.messages ?? [];
        // Register all fetched IDs so socket echoes of known messages are ignored
        msgs.forEach((m) => {
          if (m.id) seenIdsRef.current.add(String(m.id));
        });
        // Inverted FlatList: data[0] = bottom. Newest message must be first.
        // Backend returns ASC (oldest→newest), so reverse to get newest first.
        const reversed = [...msgs].reverse();
        if (p === 1) {
          setMessages(reversed);
        } else {
          // Older pages: append to tail (= visual top in inverted list)
          setMessages((prev) => [...prev, ...reversed]);
        }
        setHasMore(msgs.length >= 30);
      } catch {
        setMessages([]);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    fetchMessages(1).finally(() => setLoading(false));
  }, [fetchMessages]);

  // Re-fetch when app returns to foreground (catches messages missed in background)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        fetchMessages(1);
      }
    });
    return () => sub.remove();
  }, [fetchMessages]);

  // Polling fallback: when socket is disconnected, poll every 15 s for new messages
  useEffect(() => {
    if (wsConnected) return;
    const interval = setInterval(() => fetchMessages(1), 15_000);
    return () => clearInterval(interval);
  }, [wsConnected, fetchMessages]);

  // Append incoming socket message — deduplicated by sender + ID
  useEffect(() => {
    if (!incomingMessage) return;
    const convId =
      incomingMessage.conversation_id ?? incomingMessage.conversationId;
    if (convId !== conversationId) return;

    // Messages sent by current user are already added optimistically in handleSend.
    // The backend echoes the event back to the sender, skip it to avoid duplicates.
    const senderId = incomingMessage.sender_id ?? incomingMessage.senderId;
    if (senderId && String(senderId) === String(user?.id)) return;

    // Secondary dedup by message ID for edge cases (reconnect replays etc.)
    const msgId = String(
      incomingMessage.message_id ?? incomingMessage.id ?? "",
    );
    if (msgId && seenIdsRef.current.has(msgId)) return;
    if (msgId) seenIdsRef.current.add(msgId);

    // Inverted list: prepend so new message appears at bottom
    setMessages((prev) => [incomingMessage, ...prev]);
    if (msgId) markMessageRead(msgId);
  }, [incomingMessage]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    setText("");
    setSending(true);
    try {
      const { data } = await chatService.sendMessage(conversationId, content);
      // Backend returns { id, status, message: { id, content, sender_id, ... } }
      const msgObj = data.message ?? data;
      const newId = String(msgObj.id ?? data.id ?? "");
      // Pre-register ID so the server's socket echo to sender is ignored
      if (newId) seenIdsRef.current.add(newId);
      // Inverted list: prepend so sent message appears at bottom
      setMessages((prev) => [msgObj, ...prev]);
    } catch {
      Alert.alert("Error", "Message failed to send.");
      setText(content); // Restore
    } finally {
      setSending(false);
    }
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync();
    if (!result.canceled && result.assets?.[0]) {
      try {
        const { data } = await chatService.uploadFile(
          conversationId,
          result.assets[0],
        );
        setMessages((prev) => [...prev, data]);
      } catch {
        Alert.alert("Error", "File upload failed.");
      }
    }
  };

  const handleTyping = (val) => {
    setText(val);
    sendTypingStart(conversationId);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => sendTypingStop(conversationId),
      2000,
    );
  };

  const isTyping = typingState[conversationId] ?? false;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F3F4F6" }}
      behavior="padding"
      keyboardVerticalOffset={
        Platform.OS === "ios"
          ? 90
          : // Android: navigation header (~56) + status bar height
            56 + (StatusBar.currentHeight ?? 24)
      }
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        inverted
        keyExtractor={(item, i) => String(item.id ?? i)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onEndReachedThreshold={0.2}
        onEndReached={() => {
          if (hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchMessages(nextPage);
          }
        }}
        ListHeaderComponent={
          isTyping ? (
            <View style={{ paddingLeft: 12, paddingBottom: 4 }}>
              <Text
                style={{ color: "#6B7280", fontSize: 12, fontStyle: "italic" }}
              >
                {recipientName} is typing...
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isMine = (item.sender_id ?? item.senderId) === user?.id;
          return (
            <View
              style={{
                alignItems: isMine ? "flex-end" : "flex-start",
                marginBottom: 2,
              }}
            >
              <View
                style={{
                  maxWidth: "75%",
                  backgroundColor: isMine ? "#4F46E5" : "#fff",
                  borderRadius: 16,
                  borderBottomRightRadius: isMine ? 4 : 16,
                  borderBottomLeftRadius: isMine ? 16 : 4,
                  padding: 12,
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                {item.file_url ? (
                  <Text style={{ color: isMine ? "#C7D2FE" : "#4F46E5" }}>
                    📎 {item.file_name ?? "Attachment"}
                  </Text>
                ) : (
                  <Text
                    style={{
                      color: isMine ? "#fff" : "#111827",
                      lineHeight: 20,
                    }}
                  >
                    {item.content}
                  </Text>
                )}
                <Text
                  style={{
                    color: isMine ? "#A5B4FC" : "#9CA3AF",
                    fontSize: 10,
                    marginTop: 4,
                    textAlign: "right",
                  }}
                >
                  {item.created_at
                    ? new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          padding: 10,
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          gap: 8,
        }}
      >
        <TouchableOpacity onPress={handlePickFile} style={{ padding: 8 }}>
          <Text style={{ fontSize: 22 }}>📎</Text>
        </TouchableOpacity>

        <TextInput
          value={text}
          onChangeText={handleTyping}
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
          multiline
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#D1D5DB",
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            maxHeight: 100,
            fontSize: 15,
            color: "#111827",
          }}
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || !text.trim()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: sending || !text.trim() ? "#9CA3AF" : "#4F46E5",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
