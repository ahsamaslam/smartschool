import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import studentService from "../../services/studentService";

export default function ChangePasswordScreen({ navigation }) {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!oldPassword || !newPassword || !confirm) {
      Alert.alert("Required", "Please fill in all fields.");
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert("Mismatch", "New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Too Short", "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await studentService.changePassword(user.id, oldPassword, newPassword);
      Alert.alert("Success", "Password changed successfully.", [
        { text: "OK", onPress: () => navigation.replace("Login") },
      ]);
    } catch (err) {
      const msg = err?.response?.data?.detail ?? "Failed to change password.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          backgroundColor: "#F9FAFB",
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 16, color: "#6B7280", marginBottom: 24 }}>
          You must change your password before continuing.
        </Text>

        {[
          {
            label: "Current Password",
            value: oldPassword,
            set: setOldPassword,
          },
          { label: "New Password", value: newPassword, set: setNewPassword },
          { label: "Confirm New Password", value: confirm, set: setConfirm },
        ].map(({ label, value, set }) => (
          <View key={label} style={{ marginBottom: 16 }}>
            <Text
              style={{ color: "#374151", marginBottom: 6, fontWeight: "500" }}
            >
              {label}
            </Text>
            <TextInput
              value={value}
              onChangeText={set}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 8,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                color: "#111827",
                backgroundColor: "#fff",
              }}
            />
          </View>
        ))}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: loading ? "#818CF8" : "#4F46E5",
            borderRadius: 8,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              Change Password
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
