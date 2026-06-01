import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import studentService from "../../services/studentService";

export default function EnrollmentScreen() {
  const { user } = useAuth();
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEnrollment = async () => {
    try {
      const { data } = await studentService.getEnrollment(user.id);
      setEnrollment(data);
    } catch {
      setEnrollment(null);
    }
  };

  useEffect(() => {
    fetchEnrollment().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!enrollment || enrollment.enrolled === false) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#6B7280" }}>No enrollment data found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchEnrollment();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={{ padding: 16, gap: 14 }}>
        {/* Class Info */}
        <View
          style={{
            backgroundColor: "#4F46E5",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <Text style={{ color: "#C7D2FE", fontSize: 13 }}>Current Class</Text>
          <Text
            style={{
              color: "#fff",
              fontWeight: "bold",
              fontSize: 22,
              marginTop: 4,
            }}
          >
            {enrollment.class_name ?? "—"}
          </Text>
          {enrollment.section && (
            <Text style={{ color: "#A5B4FC", marginTop: 4 }}>
              Section: {enrollment.section}
            </Text>
          )}
          {enrollment.academic_year && (
            <Text style={{ color: "#A5B4FC", marginTop: 2 }}>
              Year: {enrollment.academic_year}
            </Text>
          )}
        </View>

        {/* School Info */}
        {enrollment.school_name && (
          <InfoCard title="School">
            <Text style={{ color: "#374151", fontSize: 16 }}>
              {enrollment.school_name}
            </Text>
          </InfoCard>
        )}

        {/* Subjects */}
        {enrollment.subjects?.length > 0 && (
          <InfoCard title="Enrolled Subjects">
            {enrollment.subjects.map((s, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 8,
                  borderBottomWidth: i < enrollment.subjects.length - 1 ? 1 : 0,
                  borderBottomColor: "#F3F4F6",
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#4F46E5",
                    marginRight: 10,
                  }}
                />
                <Text style={{ color: "#374151", flex: 1 }}>
                  {s.subject_name ?? s.name}
                </Text>
                {s.teacher_name && (
                  <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                    {s.teacher_name}
                  </Text>
                )}
              </View>
            ))}
          </InfoCard>
        )}

        {/* Dates */}
        {(enrollment.enrollment_date || enrollment.enrolled_at || enrollment.start_date) && (
          <InfoCard title="Enrollment Details">
            {(enrollment.enrollment_date || enrollment.enrolled_at) && (
              <DetailRow
                label="Enrolled"
                value={new Date(
                  enrollment.enrollment_date ?? enrollment.enrolled_at,
                ).toLocaleDateString()}
              />
            )}
            {enrollment.start_date && (
              <DetailRow
                label="Term Start"
                value={new Date(enrollment.start_date).toLocaleDateString()}
              />
            )}
            {enrollment.end_date && (
              <DetailRow
                label="Term End"
                value={new Date(enrollment.end_date).toLocaleDateString()}
              />
            )}
          </InfoCard>
        )}
      </View>
    </ScrollView>
  );
}

function InfoCard({ title, children }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text style={{ fontWeight: "600", color: "#374151", marginBottom: 12 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
      }}
    >
      <Text style={{ color: "#6B7280" }}>{label}</Text>
      <Text style={{ color: "#374151", fontWeight: "500" }}>{value}</Text>
    </View>
  );
}
