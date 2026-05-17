import { useAuth } from "../context/AuthContext";
import { View, ActivityIndicator } from "react-native";
import AuthStack from "./AuthStack";
import MainTabs from "./MainTabs";

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return user ? <MainTabs /> : <AuthStack />;
}
