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
        setHw(data);
        // Restore saved progress
        if (data.saved_progress) {
          setAnswers(data.saved_progress);
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
      await homeworkService.saveProgress(homeworkId, answers);
      Alert.alert("Saved", "Progress saved.");
    } catch {
      Alert.alert("Error", "Could not save progress.");
    }
  };

  const handleSubmitInteractive = async () => {
    setSubmitting(true);
    try {
      await homeworkService.submitInteractive(homeworkId, answers);
      Alert.alert("Submitted!", "Homework submitted successfully.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.detail ?? "Submission failed.");
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
      Alert.alert("Error", err?.response?.data?.detail ?? "Upload failed.");
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
  const isSubmitted = ["submitted", "graded"].includes(hw.status);

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
        {hw.grade != null && (
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
              Grade: {hw.grade} / {hw.max_grade ?? 100}
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

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={handleSaveProgress}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: "#4F46E5",
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#4F46E5", fontWeight: "600" }}>
                  Save Draft
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitInteractive}
                disabled={submitting}
                style={{
                  flex: 1,
                  backgroundColor: submitting ? "#9CA3AF" : "#4F46E5",
                  borderRadius: 8,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    Submit
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
