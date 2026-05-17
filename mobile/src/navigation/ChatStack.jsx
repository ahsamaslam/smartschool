import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ConversationsScreen from "../screens/chat/ConversationsScreen";
import ChatScreen from "../screens/chat/ChatScreen";
import NewChatScreen from "../screens/chat/NewChatScreen";

const Stack = createNativeStackNavigator();

export default function ChatStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#4F46E5" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Stack.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{ title: "Messages" }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({
          title: route.params?.recipientName ?? "Chat",
        })}
      />
      <Stack.Screen
        name="NewChat"
        component={NewChatScreen}
        options={{ title: "New Message" }}
      />
    </Stack.Navigator>
  );
}
