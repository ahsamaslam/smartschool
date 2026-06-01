import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import quizService from "../../services/quizService";

export default function QuizScreen({ route, navigation }) {
  const { user } = useAuth();
  const { quizInstanceId, quizTitle } = route.params ?? {};

  const [quiz, setQuiz] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: instance }, { data: attempt }] = await Promise.all([
          quizService.getInstance(quizInstanceId),
          quizService.startAttempt(user.id, quizInstanceId),
        ]);
        // Normalize: map quiz_question_id → id for questions
        const normalized = {
          ...instance,
          questions: (instance.questions ?? []).map((q) => ({
            ...q,
            id: q.id ?? q.quiz_question_id,
          })),
        };
        setQuiz(normalized);
        setAttemptId(attempt.attempt_id ?? attempt.id);
      } catch (err) {
        Alert.alert(
          "Error",
          err?.response?.data?.detail ?? "Could not load quiz.",
        );
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [quizInstanceId]);

  const handleSubmit = async () => {
    const unanswered = quiz.questions.filter((q) => answers[q.id] == null);
    if (unanswered.length > 0) {
      Alert.alert(
        "Incomplete",
        `${unanswered.length} question(s) unanswered. Submit anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit", onPress: doSubmit },
        ],
      );
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      await quizService.submitAttempt(user.id, quizInstanceId, answers);
      const { data: result } = await quizService.getAttemptResult(attemptId);
      navigation.replace("QuizResults", { result, quizTitle });
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.detail ?? "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!quiz) return null;

  const questions = quiz.questions ?? [];
  const q = questions[currentIdx];
  const answered = Object.keys(answers).length;

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* Progress Header */}
      <View style={{ backgroundColor: "#4F46E5", padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text style={{ color: "#C7D2FE", fontSize: 13 }}>
            Question {currentIdx + 1} of {questions.length}
          </Text>
          <Text style={{ color: "#C7D2FE", fontSize: 13 }}>
            {answered} answered
          </Text>
        </View>
        <View
          style={{ height: 4, backgroundColor: "#3730A3", borderRadius: 2 }}
        >
          <View
            style={{
              height: 4,
              width: `${((currentIdx + 1) / questions.length) * 100}%`,
              backgroundColor: "#A5B4FC",
              borderRadius: 2,
            }}
          />
        </View>
      </View>

      {/* Question */}
      <ScrollView
        style={{ flex: 1, padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {q && (
          <View>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: "#111827",
                marginBottom: 20,
                lineHeight: 26,
              }}
            >
              {q.question_text}
            </Text>

            {/* MCQ Options */}
            {q.question_type === "mcq" &&
              q.options?.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() =>
                    setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                  }
                  style={{
                    borderWidth: 2,
                    borderColor: answers[q.id] === opt ? "#4F46E5" : "#E5E7EB",
                    backgroundColor: answers[q.id] === opt ? "#EEF2FF" : "#fff",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 10,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor:
                        answers[q.id] === opt ? "#4F46E5" : "#D1D5DB",
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 10,
                    }}
                  >
                    {answers[q.id] === opt && (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: "#4F46E5",
                        }}
                      />
                    )}
                  </View>
                  <Text style={{ color: "#374151", flex: 1, fontSize: 15 }}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}

            {/* True/False */}
            {q.question_type === "true_false" &&
              ["True", "False"].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() =>
                    setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                  }
                  style={{
                    borderWidth: 2,
                    borderColor: answers[q.id] === opt ? "#4F46E5" : "#E5E7EB",
                    backgroundColor: answers[q.id] === opt ? "#EEF2FF" : "#fff",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 10,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "600",
                      color: answers[q.id] === opt ? "#4F46E5" : "#374151",
                    }}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}

            {/* Short Answer */}
            {["short_answer", "fill_in_blank"].includes(q.question_type) && (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: "#D1D5DB",
                  borderRadius: 10,
                  padding: 12,
                  backgroundColor: "#fff",
                }}
              >
                <Text style={{ color: "#9CA3AF" }} onPress={() => {}}>
                  {answers[q.id] ?? "Tap to answer..."}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View
        style={{
          flexDirection: "row",
          padding: 16,
          gap: 12,
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          backgroundColor: "#fff",
        }}
      >
        <TouchableOpacity
          onPress={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: currentIdx === 0 ? "#E5E7EB" : "#4F46E5",
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: currentIdx === 0 ? "#9CA3AF" : "#4F46E5",
              fontWeight: "600",
            }}
          >
            ‹ Prev
          </Text>
        </TouchableOpacity>

        {currentIdx < questions.length - 1 ? (
          <TouchableOpacity
            onPress={() => setCurrentIdx((i) => i + 1)}
            style={{
              flex: 1,
              backgroundColor: "#4F46E5",
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Next ›</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              flex: 1,
              backgroundColor: submitting ? "#9CA3AF" : "#10B981",
              borderRadius: 8,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Submit Quiz
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
