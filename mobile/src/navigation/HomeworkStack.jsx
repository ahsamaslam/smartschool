import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeworkListScreen from "../screens/homework/HomeworkListScreen";
import HomeworkDetailScreen from "../screens/homework/HomeworkDetailScreen";

const Stack = createNativeStackNavigator();

export default function HomeworkStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#4F46E5" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Stack.Screen
        name="HomeworkList"
        component={HomeworkListScreen}
        options={{ title: "Homework" }}
      />
      <Stack.Screen
        name="HomeworkDetail"
        component={HomeworkDetailScreen}
        options={({ route }) => ({
          title: route.params?.title ?? "Homework",
        })}
      />
    </Stack.Navigator>
  );
}
