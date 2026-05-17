import api from "../api";

const studentService = {
  getDashboard: (studentId) => api.get(`/students/dashboard/${studentId}`),

  getAttendanceSummary: (studentId) =>
    api.get(`/students/attendance/summary/${studentId}`),

  getSubjectTopics: (subjectId, studentId) =>
    api.get(`/students/subjects/${subjectId}/topics`, {
      params: { student_id: studentId },
    }),

  getVideoDetails: (videoId, studentId) =>
    api.get(`/students/videos/${videoId}`, {
      params: { student_id: studentId },
    }),

  trackVideoEvent: (sessionId, eventType, timestampInVideo) =>
    api.post(`/students/videos/track-event`, {
      session_id: sessionId,
      event_type: eventType,
      timestamp_in_video: timestampInVideo,
    }),

  askQuestion: (studentId, videoId, question) =>
    api.post(`/qa/ask`, {
      student_id: studentId,
      video_id: videoId,
      question,
    }),

  getProfile: (studentId) =>
    api.get(`/auth/me`, { params: { user_id: studentId } }),

  updateProfile: (studentId, data) =>
    api.put(`/auth/profile/${studentId}`, data),

  changePassword: (userId, oldPassword, newPassword) =>
    api.post(`/auth/password/change`, {
      user_id: userId,
      old_password: oldPassword,
      new_password: newPassword,
    }),

  getEnrollment: (studentId) => api.get(`/students/enrollment/${studentId}`),
};

export default studentService;
