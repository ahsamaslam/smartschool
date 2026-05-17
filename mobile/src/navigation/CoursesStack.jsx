import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MyCoursesScreen from "../screens/courses/MyCoursesScreen";
import SubjectScreen from "../screens/courses/SubjectScreen";
import TopicLearnScreen from "../screens/courses/TopicLearnScreen";
import SlidesViewerScreen from "../screens/courses/SlidesViewerScreen";
import VideoLessonScreen from "../screens/courses/VideoLessonScreen";

const Stack = createNativeStackNavigator();

export default function CoursesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#4F46E5" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Stack.Screen
        name="MyCourses"
        component={MyCoursesScreen}
        options={{ title: "My Courses" }}
      />
      <Stack.Screen
        name="Subject"
        component={SubjectScreen}
        options={({ route }) => ({
          title: route.params?.subjectName ?? "Subject",
        })}
      />
      <Stack.Screen
        name="TopicLearn"
        component={TopicLearnScreen}
        options={({ route }) => ({ title: route.params?.topicName ?? "Topic" })}
      />
      <Stack.Screen
        name="SlidesViewer"
        component={SlidesViewerScreen}
        options={{ title: "Slides", headerShown: false }}
      />
      <Stack.Screen
        name="VideoLesson"
        component={VideoLessonScreen}
        options={{ title: "Video Lesson", headerShown: false }}
      />
    </Stack.Navigator>
  );
}
