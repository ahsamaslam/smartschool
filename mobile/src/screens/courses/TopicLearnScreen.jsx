import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import learningService from "../../services/learningService";
import { API_URL } from "../../config";

const API_BASE = API_URL;
const STATIC_BASE = API_BASE.replace("/api", "");

export default function TopicLearnScreen({ route, navigation }) {
  const { topicId } = route.params;
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await learningService.getStudentTopic(topicId);
        // API returns { data: {...topic row...}, progress: {...} }
        const topicRow = data?.data ?? data;
        // Normalize field names from DB columns to what the screen uses
        const normalized = {
          ...topicRow,
          topic_name: topicRow.title ?? topicRow.topic_name ?? topicRow.name,
          slides: (() => {
            const raw = topicRow.slides_json;
            if (!raw) return [];
            try { return JSON.parse(raw); } catch { return []; }
          })(),
          video_url: topicRow.lecture_video_url ?? topicRow.video_url,
          quiz_instance_id: topicRow.quiz_instance_id ?? null,
        };
        setTopic(normalized);
        await learningService.updateProgress({
          topic_id: topicId,
          status: "in_progress",
        });
      } catch (err) {
        Alert.alert("Error", "Could not load topic.");
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [topicId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!topic) return null;

  const hasSlides = topic.slides && topic.slides.length > 0;
  const hasVideo = !!topic.video_url;
  const hasQuiz = !!topic.quiz_instance_id;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* Topic Info */}
      <View style={{ padding: 20 }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "bold",
            color: "#111827",
            marginBottom: 8,
          }}
        >
          {topic.topic_name ?? topic.name}
        </Text>
        {topic.description && (
          <Text style={{ color: "#6B7280", lineHeight: 20 }}>
            {topic.description}
          </Text>
        )}
      </View>

      {/* Learning Materials */}
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#374151" }}>
          Learning Materials
        </Text>

        {hasSlides && (
          <MaterialCard
            emoji="🎯"
            title="Lesson Slides"
            subtitle={`${topic.slides.length} slides`}
            color="#4F46E5"
            onPress={() =>
              navigation.navigate("SlidesViewer", {
                slides: topic.slides,
                topicName: topic.topic_name ?? topic.name,
              })
            }
          />
        )}

        {hasVideo && (
          <MaterialCard
            emoji="🎥"
            title="Video Lesson"
            subtitle="Watch the lecture"
            color="#EF4444"
            onPress={() =>
              navigation.navigate("VideoLesson", {
                videoUrl: topic.video_url.startsWith("http")
                  ? topic.video_url
                  : `${STATIC_BASE}${topic.video_url}`,
                topicId,
                videoId: topic.video_id,
                topicName: topic.topic_name ?? topic.name,
              })
            }
          />
        )}

        {hasQuiz && (
          <MaterialCard
            emoji="🧠"
            title="Quiz"
            subtitle="Test your knowledge"
            color="#10B981"
            onPress={() =>
              navigation.navigate("MoreTab", {
                screen: "Quiz",
                params: {
                  quizInstanceId: topic.quiz_instance_id,
                  quizTitle: `${topic.topic_name ?? topic.name} Quiz`,
                },
              })
            }
          />
        )}

        {!hasSlides && !hasVideo && !hasQuiz && (
          <View style={{ alignItems: "center", padding: 32 }}>
            <Text style={{ color: "#9CA3AF" }}>
              No materials available yet.
            </Text>
          </View>
        )}
      </View>

      {/* Mark Complete Button */}
      <View style={{ padding: 16, paddingBottom: 40 }}>
        <TouchableOpacity
          onPress={async () => {
            try {
              await learningService.updateProgress({
                topic_id: topicId,
                status: "completed",
              });
              Alert.alert("Done!", "Topic marked as complete.", [
                { text: "OK", onPress: () => navigation.goBack() },
              ]);
            } catch {
              Alert.alert("Error", "Could not update progress.");
            }
          }}
          style={{
            backgroundColor: "#10B981",
            borderRadius: 8,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            Mark as Complete ✓
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MaterialCard({ emoji, title, subtitle, color, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        borderLeftWidth: 4,
        borderLeftColor: color,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 28, marginRight: 12 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600", color: "#111827", fontSize: 15 }}>
          {title}
        </Text>
        <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      <Text style={{ color: "#9CA3AF", fontSize: 20 }}>›</Text>
    </TouchableOpacity>
  );
}
