import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function QuizResultsScreen({ route }) {
  const navigation = useNavigation();
  const { result, quizTitle } = route.params ?? {};

  if (!result) return null;

  const score = result.score ?? 0;
  const total = result.total ?? 0;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = result.passed ?? percentage >= 60;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* Result Header */}
      <View
        style={{
          backgroundColor: passed ? "#4F46E5" : "#EF4444",
          padding: 32,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 52, marginBottom: 8 }}>
          {passed ? "🎉" : "📖"}
        </Text>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold" }}>
          {passed ? "Passed!" : "Keep Practicing"}
        </Text>
        <Text
          style={{
            color: passed ? "#C7D2FE" : "#FCA5A5",
            fontSize: 15,
            marginTop: 4,
          }}
        >
          {quizTitle}
        </Text>
      </View>

      {/* Score Card */}
      <View style={{ padding: 24 }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 4,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 64,
              fontWeight: "bold",
              color: passed ? "#4F46E5" : "#EF4444",
            }}
          >
            {percentage}%
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 16, marginTop: 4 }}>
            {score} / {total} correct
          </Text>

          {/* Progress Ring placeholder */}
          <View
            style={{
              marginTop: 16,
              height: 8,
              width: "100%",
              backgroundColor: "#E5E7EB",
              borderRadius: 4,
            }}
          >
            <View
              style={{
                height: 8,
                width: `${percentage}%`,
                backgroundColor: passed ? "#4F46E5" : "#EF4444",
                borderRadius: 4,
              }}
            />
          </View>
        </View>

        {/* Per-question breakdown */}
        {result.answers?.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text
              style={{
                fontWeight: "600",
                color: "#374151",
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              Question Breakdown
            </Text>
            {result.answers.map((a, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  padding: 14,
                  borderLeftWidth: 4,
                  borderLeftColor: a.correct ? "#10B981" : "#EF4444",
                }}
              >
                <Text
                  style={{
                    color: "#374151",
                    fontWeight: "500",
                    marginBottom: 4,
                  }}
                >
                  {i + 1}. {a.question_text}
                </Text>
                <Text
                  style={{
                    color: a.correct ? "#059669" : "#DC2626",
                    fontSize: 13,
                  }}
                >
                  Your answer: {a.student_answer ?? "—"}
                </Text>
                {!a.correct && (
                  <Text style={{ color: "#059669", fontSize: 13 }}>
                    Correct: {a.correct_answer}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={{ marginTop: 24, gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              backgroundColor: "#4F46E5",
              borderRadius: 8,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
