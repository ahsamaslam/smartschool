import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../context/AuthContext";
import studentService from "../../services/studentService";

export default function ProfileScreen({ navigation }) {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", bio: "" });
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      const { data } = await studentService.getProfile(user.id);
      setProfile(data);
      setForm({
        name: data.name ?? "",
        phone: data.phone ?? "",
        bio: data.bio ?? "",
      });
    } catch {
      setProfile(user);
      setForm({
        name: user.name ?? "",
        phone: user.phone ?? "",
        bio: user.bio ?? "",
      });
    }
  };

  useEffect(() => {
    fetchProfile().finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await studentService.updateProfile(user.id, form);
      await updateUser(data);
      setProfile(data);
      setEditing(false);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.detail ?? "Update failed.");
    } finally {
      setSaving(false);
    }
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
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchProfile();
            setRefreshing(false);
          }}
        />
      }
    >
      {/* Avatar Header */}
      <View
        style={{
          backgroundColor: "#4F46E5",
          padding: 32,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: "#fff",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 12,
            borderWidth: 3,
            borderColor: "#C7D2FE",
          }}
        >
          <Text style={{ fontSize: 36, fontWeight: "bold", color: "#4F46E5" }}>
            {(profile?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 20 }}>
          {profile?.name ?? user?.email}
        </Text>
        <Text style={{ color: "#C7D2FE", fontSize: 14, marginTop: 2 }}>
          {user?.email}
        </Text>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 4,
            marginTop: 8,
          }}
        >
          <Text style={{ color: "#4F46E5", fontWeight: "600", fontSize: 12 }}>
            Student
          </Text>
        </View>
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        {/* Info Card */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 16,
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
              marginBottom: 16,
            }}
          >
            <Text style={{ fontWeight: "600", color: "#374151", fontSize: 16 }}>
              Personal Information
            </Text>
            <TouchableOpacity onPress={() => setEditing((e) => !e)}>
              <Text style={{ color: "#4F46E5", fontWeight: "600" }}>
                {editing ? "Cancel" : "Edit"}
              </Text>
            </TouchableOpacity>
          </View>

          {editing ? (
            <View style={{ gap: 12 }}>
              {[
                { label: "Full Name", key: "name" },
                { label: "Phone", key: "phone" },
                { label: "Bio", key: "bio", multiline: true },
              ].map(({ label, key, multiline }) => (
                <View key={key}>
                  <Text
                    style={{ color: "#6B7280", fontSize: 13, marginBottom: 4 }}
                  >
                    {label}
                  </Text>
                  <TextInput
                    value={form[key]}
                    onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                    placeholder={label}
                    placeholderTextColor="#9CA3AF"
                    multiline={multiline}
                    numberOfLines={multiline ? 3 : 1}
                    style={{
                      borderWidth: 1,
                      borderColor: "#D1D5DB",
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      color: "#111827",
                      fontSize: 15,
                      textAlignVertical: multiline ? "top" : "center",
                      minHeight: multiline ? 70 : 44,
                    }}
                  />
                </View>
              ))}

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: saving ? "#9CA3AF" : "#4F46E5",
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <InfoRow label="Name" value={profile?.name ?? "—"} />
              <InfoRow label="Email" value={user?.email ?? "—"} />
              <InfoRow label="Phone" value={profile?.phone ?? "—"} />
              {profile?.bio && <InfoRow label="Bio" value={profile.bio} />}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Enrollment")}
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
            <Text style={{ flex: 1, fontWeight: "600", color: "#111827" }}>
              My Enrollment
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 18 }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Exams")}
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
            <Text style={{ flex: 1, fontWeight: "600", color: "#111827" }}>
              My Exams
            </Text>
            <Text style={{ color: "#9CA3AF", fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={logout}
          style={{
            borderWidth: 1,
            borderColor: "#EF4444",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginTop: 4,
          }}
        >
          <Text style={{ color: "#EF4444", fontWeight: "600" }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
        paddingBottom: 10,
      }}
    >
      <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 2 }}>
        {label}
      </Text>
      <Text style={{ color: "#111827", fontSize: 15 }}>{value}</Text>
    </View>
  );
}
