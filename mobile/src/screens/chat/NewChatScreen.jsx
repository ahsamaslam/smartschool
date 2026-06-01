import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import chatService from "../../services/chatService";

export default function NewChatScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    chatService
      .getEligibleContacts()
      .then(({ data }) => {
        // API returns { groups: [{ label, members: [...] }] } or { contacts: [...] }
        let list = data.contacts ?? [];
        if (!list.length && data.groups) {
          list = data.groups.flatMap((g) => g.members ?? []);
        }
        // Normalize full_name → name
        list = list.map((c) => ({ ...c, name: c.name ?? c.full_name }));
        setContacts(list);
        setFiltered(list);
      })
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(contacts);
      return;
    }
    const q = query.toLowerCase();
    setFiltered(
      contacts.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q),
      ),
    );
  }, [query, contacts]);

  const handleStart = async (contact) => {
    setCreating(true);
    try {
      const { data } = await chatService.createConversation(
        contact.id ?? contact.user_id,
      );
      const convId = data.conversation_id ?? data.id;
      navigation.replace("Chat", {
        conversationId: convId,
        recipientName: contact.name,
      });
    } catch (err) {
      const msg = err?.response?.data?.detail;
      if (msg?.includes("already exists") || msg?.includes("existing")) {
        const convId = err.response?.data?.conversation_id;
        if (convId) {
          navigation.replace("Chat", {
            conversationId: convId,
            recipientName: contact.name,
          });
          return;
        }
      }
      Alert.alert("Error", msg ?? "Could not start conversation.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* Search */}
      <View
        style={{
          padding: 16,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search teachers..."
          placeholderTextColor="#9CA3AF"
          style={{
            borderWidth: 1,
            borderColor: "#D1D5DB",
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 15,
            color: "#111827",
          }}
          autoFocus
        />
      </View>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color="#4F46E5" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id ?? item.user_id)}
          contentContainerStyle={{ padding: 12, gap: 4 }}
          ListEmptyComponent={
            <Text
              style={{ textAlign: "center", color: "#6B7280", marginTop: 32 }}
            >
              No contacts found.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleStart(item)}
              disabled={creating}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 14,
                marginBottom: 4,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#EEF2FF",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <Text
                  style={{ fontWeight: "bold", color: "#4F46E5", fontSize: 16 }}
                >
                  {(item.name ?? "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "600", color: "#111827" }}>
                  {item.name}
                </Text>
                {item.subject && (
                  <Text style={{ color: "#6B7280", fontSize: 13 }}>
                    {item.subject}
                  </Text>
                )}
              </View>
              <Text style={{ color: "#4F46E5", fontWeight: "600" }}>
                Message
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
