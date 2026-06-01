import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ExamsScreen from "../screens/exams/ExamsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import EnrollmentScreen from "../screens/profile/EnrollmentScreen";
import AttendanceScreen from "../screens/profile/AttendanceScreen";
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
        name="Exams"
        component={ExamsScreen}
        options={{ title: "My Exams" }}
      />
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
        name="Attendance"
        component={AttendanceScreen}
        options={{ title: "My Attendance" }}
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
