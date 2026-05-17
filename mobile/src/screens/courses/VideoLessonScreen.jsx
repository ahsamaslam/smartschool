import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import studentService from "../../services/studentService";

export default function VideoLessonScreen({ route }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { videoUrl, videoId, topicId, topicName } = route.params ?? {};

  const videoRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState({});
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState(null);
  const [qaLoading, setQaLoading] = useState(false);

  // ── Start video session ──────────────────────────────────────────────────
  useEffect(() => {
    if (videoId && user?.id) {
      studentService
        .getVideoDetails(videoId, user.id)
        .then(({ data }) => setSessionId(data.session_id ?? null))
        .catch(() => {});
    }
  }, [videoId]);

  // ── Track play/pause events ──────────────────────────────────────────────
  const trackEvent = async (eventType) => {
    if (!sessionId) return;
    try {
      const ts = status.positionMillis ? status.positionMillis / 1000 : 0;
      await studentService.trackVideoEvent(sessionId, eventType, ts);
    } catch {
      // Best-effort tracking
    }
  };

  const onPlaybackStatusUpdate = (s) => {
    setStatus(s);
    if (s.didJustFinish) {
      trackEvent("complete");
    }
  };

  // ── Ask Q&A ──────────────────────────────────────────────────────────────
  const handleAskQuestion = async () => {
    if (!qaQuestion.trim()) return;
    setQaLoading(true);
    try {
      const { data } = await studentService.askQuestion(
        user.id,
        videoId,
        qaQuestion.trim(),
      );
      setQaAnswer(data.answer ?? data.response ?? "No answer returned.");
    } catch {
      Alert.alert("Error", "Could not get an answer. Please try again.");
    } finally {
      setQaLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Top Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: "#111",
        }}
      >
        <TouchableOpacity
          onPress={() => {
            trackEvent("pause");
            navigation.goBack();
          }}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: "#fff", fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
        <Text
          style={{ color: "#fff", fontWeight: "600", flex: 1 }}
          numberOfLines={1}
        >
          {topicName ?? "Video Lesson"}
        </Text>
      </View>

      {/* Video Player */}
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onLoad={() => trackEvent("start")}
      />

      {/* Q&A Section */}
      <ScrollView
        style={{ flex: 1, backgroundColor: "#F9FAFB" }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: 16 }}>
          <Text
            style={{
              fontWeight: "600",
              fontSize: 16,
              color: "#111827",
              marginBottom: 12,
            }}
          >
            Ask a Question
          </Text>

          <View
            style={{
              flexDirection: "row",
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            <View style={{ flex: 1, padding: 12 }}>
              <Text
                style={{ color: "#111827", fontSize: 14 }}
                onPress={() => {}}
              >
                {qaQuestion || ""}
              </Text>
            </View>
          </View>

          {/* Simple text input replacement */}
          <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={handleAskQuestion}
              disabled={qaLoading || !qaQuestion.trim()}
              style={{
                backgroundColor:
                  qaLoading || !qaQuestion.trim() ? "#9CA3AF" : "#4F46E5",
                borderRadius: 8,
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              {qaLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "600" }}>Ask AI</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Answer */}
          {qaAnswer && (
            <View
              style={{
                marginTop: 16,
                backgroundColor: "#EEF2FF",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <Text
                style={{ fontWeight: "600", color: "#4F46E5", marginBottom: 6 }}
              >
                Answer
              </Text>
              <Text style={{ color: "#374151", lineHeight: 22 }}>
                {qaAnswer}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
