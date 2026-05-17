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

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);

      if (user.role !== "student") {
        Alert.alert(
          "Access Denied",
          "This app is for students only. Please use the web portal.",
        );
        return;
      }

      if (user.must_change_password) {
        navigation.replace("ChangePassword");
      }
      // If user is valid student, AppNavigator auto-switches to MainTabs
    } catch (err) {
      const msg =
        err?.response?.data?.detail ?? "Invalid credentials. Please try again.";
      Alert.alert("Login Failed", msg);
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
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#4F46E5",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "bold",
                color: "#fff",
                marginBottom: 8,
              }}
            >
              Smart School
            </Text>
            <Text style={{ color: "#C7D2FE", fontSize: 16 }}>
              Student Portal
            </Text>
          </View>

          {/* Card */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 24,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "600",
                color: "#111827",
                marginBottom: 24,
              }}
            >
              Sign In
            </Text>

            {/* Email */}
            <Text
              style={{ color: "#374151", marginBottom: 6, fontWeight: "500" }}
            >
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="student@school.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 8,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                color: "#111827",
                marginBottom: 16,
              }}
            />

            {/* Password */}
            <Text
              style={{ color: "#374151", marginBottom: 6, fontWeight: "500" }}
            >
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 8,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 16,
                color: "#111827",
                marginBottom: 24,
              }}
            />

            {/* Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={{
                backgroundColor: loading ? "#818CF8" : "#4F46E5",
                borderRadius: 8,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}
                >
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
