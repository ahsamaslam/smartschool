import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import homeworkService from "../../services/homeworkService";

export default function HomeworkDetailScreen({ route, navigation }) {
  const { homeworkId } = route.params ?? {};
  const [hw, setHw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await homeworkService.studentGet(homeworkId);
        // API returns { homework, submission, questions, answers } nested
        const hw = data?.homework ?? data;
        const submission = data?.submission ?? {};
        const questions = (data?.questions ?? hw.questions ?? []).map((q) => ({
          ...q,
          options: q.options_json
            ? (() => { try { return JSON.parse(q.options_json); } catch { return []; } })()
            : q.options ?? [],
        }));
        const savedAnswers = {};
        for (const ans of data?.answers ?? []) {
          savedAnswers[ans.homework_question_id] = ans.answer_text ?? "";
        }
        const normalized = {
          ...hw,
          submission_type: hw.homework_type ?? hw.submission_type,
          status: submission.submission_status ?? hw.submission_status ?? hw.status,
          due_date: hw.due_at ?? hw.due_date,
          grade: submission.marks_awarded ?? hw.marks_awarded,
          max_grade: hw.total_marks ?? hw.max_grade,
          feedback: submission.teacher_feedback ?? hw.teacher_feedback,
          questions,
        };
        setHw(normalized);
        if (Object.keys(savedAnswers).length > 0) {
          setAnswers(savedAnswers);
        } else if (hw.saved_progress) {
          setAnswers(hw.saved_progress);
        }
      } catch {
        Alert.alert("Error", "Could not load homework.");
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [homeworkId]);

  const handleSaveProgress = async () => {
    try {
      const answersList = Object.entries(answers).map(([homework_question_id, answer_text]) => ({
        homework_question_id,
        answer_text: String(answer_text ?? ""),
      }));
      await homeworkService.saveProgress(homeworkId, answersList);
      Alert.alert("Saved", "Progress saved.");
    } catch {
      Alert.alert("Error", "Could not save progress.");
    }
  };

  const handleSubmitInteractive = async () => {
    setSubmitting(true);
    try {
      const answersList = Object.entries(answers).map(([homework_question_id, answer_text]) => ({
        homework_question_id,
        answer_text: String(answer_text ?? ""),
      }));
      await homeworkService.submitInteractive(homeworkId, answersList);
      Alert.alert("Submitted!", "Homework submitted successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d) => d.msg ?? d).join(", ") : detail ?? "Submission failed.";
      Alert.alert("Error", String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (!result.canceled) {
      setSelectedFiles(result.assets ?? []);
    }
  };

  const handleSubmitUpload = async () => {
    if (selectedFiles.length === 0) {
      Alert.alert("No files", "Please select at least one file.");
      return;
    }
    setSubmitting(true);
    try {
      await homeworkService.submitUpload(homeworkId, selectedFiles);
      Alert.alert("Submitted!", "Files submitted successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d) => d.msg ?? d).join(", ") : detail ?? "Upload failed.";
      Alert.alert("Error", String(msg));
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

  if (!hw) return null;

  const isUploadType = hw.submission_type === "upload";
  const isSubmitted = ["submitted", "graded", "reviewed",
    "submitted_awaiting", "late_awaiting"].includes(hw.status);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={{ backgroundColor: "#4F46E5", padding: 20 }}>
        <Text style={{ color: "#C7D2FE", fontSize: 13 }}>
          {hw.subject_name} · Due{" "}
          {hw.due_date ? new Date(hw.due_date).toLocaleDateString() : "TBD"}
        </Text>
        <Text
          style={{
            color: "#fff",
            fontWeight: "bold",
            fontSize: 18,
            marginTop: 4,
          }}
        >
          {hw.title}
        </Text>
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        {/* Returned banner */}
        {hw.status === "returned" && (
          <View style={{
            backgroundColor: "#FEF3C7", borderRadius: 10, padding: 14,
            borderWidth: 1, borderColor: "#FCD34D", flexDirection: "row", alignItems: "center",
          }}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>↩️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", color: "#92400E", fontSize: 13 }}>Returned for Revision</Text>
              <Text style={{ color: "#78350F", fontSize: 12, marginTop: 2 }}>
                Your teacher returned this homework. Review the feedback below and resubmit.
              </Text>
            </View>
          </View>
        )}

        {/* Instructions */}
        {hw.instructions && (
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 16,
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text
              style={{ fontWeight: "600", color: "#374151", marginBottom: 8 }}
            >
              Instructions
            </Text>
            <Text style={{ color: "#6B7280", lineHeight: 22 }}>
              {hw.instructions}
            </Text>
          </View>
        )}

        {/* Grade (if graded) */}
        {(hw.grade != null || hw.marks_awarded != null) && (
          <View
            style={{
              backgroundColor: "#ECFDF5",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: "#A7F3D0",
            }}
          >
            <Text style={{ fontWeight: "600", color: "#065F46" }}>
              Grade: {hw.grade ?? hw.marks_awarded} / {hw.max_grade ?? hw.total_marks ?? 100}
            </Text>
            {hw.feedback && (
              <Text style={{ color: "#047857", marginTop: 4 }}>
                {hw.feedback}
              </Text>
            )}
          </View>
        )}

        {!isSubmitted && isUploadType && (
          /* Upload Submission */
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={handlePickFiles}
              style={{
                backgroundColor: "#EEF2FF",
                borderWidth: 2,
                borderColor: "#4F46E5",
                borderStyle: "dashed",
                borderRadius: 12,
                padding: 20,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 28, marginBottom: 6 }}>📎</Text>
              <Text style={{ color: "#4F46E5", fontWeight: "600" }}>
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file(s) selected`
                  : "Tap to select files"}
              </Text>
            </TouchableOpacity>

            {selectedFiles.map((f, i) => (
              <Text key={i} style={{ color: "#6B7280", fontSize: 13 }}>
                • {f.name}
              </Text>
            ))}

            <TouchableOpacity
              onPress={handleSubmitUpload}
              disabled={submitting}
              style={{
                backgroundColor: submitting ? "#9CA3AF" : "#4F46E5",
                borderRadius: 8,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Submit Files
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!isSubmitted && !isUploadType && hw.questions?.length > 0 && (
          /* Interactive Q&A */
          <View style={{ gap: 16 }}>
            {hw.questions.map((q, idx) => (
              <View
                key={q.id ?? idx}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 16,
                  shadowColor: "#000",
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Text
                  style={{
                    fontWeight: "600",
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  {idx + 1}. {q.question_text}
                </Text>

                {/* MCQ */}
                {q.question_type === "mcq" &&
                  q.options?.map((opt, oi) => (
                    <TouchableOpacity
                      key={oi}
                      onPress={() =>
                        setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor:
                          answers[q.id] === opt ? "#4F46E5" : "#E5E7EB",
                        backgroundColor:
                          answers[q.id] === opt ? "#EEF2FF" : "#fff",
                        marginBottom: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
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
                              width: 9,
                              height: 9,
                              borderRadius: 5,
                              backgroundColor: "#4F46E5",
                            }}
                          />
                        )}
                      </View>
                      <Text style={{ color: "#374151" }}>{opt}</Text>
                    </TouchableOpacity>
                  ))}

                {/* Text answer */}
                {q.question_type !== "mcq" && (
                  <TextInput
                    value={answers[q.id] ?? ""}
                    onChangeText={(v) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: v }))
                    }
                    placeholder="Your answer..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    style={{
                      borderWidth: 1,
                      borderColor: "#D1D5DB",
                      borderRadius: 8,
                      padding: 12,
                      color: "#111827",
                      textAlignVertical: "top",
                      minHeight: 80,
                    }}
                  />
                )}
              </View>
            ))}

            <TouchableOpacity
              onPress={handleSubmitInteractive}
              disabled={submitting}
              style={{
                backgroundColor: submitting ? "#9CA3AF" : "#4F46E5",
                borderRadius: 8,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  Submit Homework
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isSubmitted && (
          <View
            style={{
              backgroundColor: "#ECFDF5",
              borderRadius: 12,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 32, marginBottom: 8 }}>✅</Text>
            <Text style={{ fontWeight: "600", color: "#065F46", fontSize: 16 }}>
              Homework Submitted
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
