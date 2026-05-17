import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "../screens/profile/ProfileScreen";
import EnrollmentScreen from "../screens/profile/EnrollmentScreen";
import ExamsScreen from "../screens/exams/ExamsScreen";
import QuizScreen from "../screens/quiz/QuizScreen";
import QuizResultsScreen from "../screens/quiz/QuizResultsScreen";

const Stack = createNativeStackNavigator();

export default function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#4F46E5" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "My Profile" }}
      />
      <Stack.Screen
        name="Enrollment"
        component={EnrollmentScreen}
        options={{ title: "My Enrollment" }}
      />
      <Stack.Screen
        name="Exams"
        component={ExamsScreen}
        options={{ title: "Exams" }}
      />
      <Stack.Screen
        name="Quiz"
        component={QuizScreen}
        options={({ route }) => ({ title: route.params?.quizTitle ?? "Quiz" })}
      />
      <Stack.Screen
        name="QuizResults"
        component={QuizResultsScreen}
        options={{ title: "Quiz Results" }}
      />
    </Stack.Navigator>
  );
}
