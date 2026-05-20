import api from "./api";
import { API_ROUTES } from "../utils/constants";

const studentService = {
  // Dashboard
  getDashboard: (studentId) =>
    api.get(`${API_ROUTES.STUDENTS}/dashboard/${studentId}`),
  getAttendanceSummary: (studentId) =>
    api.get(`${API_ROUTES.STUDENTS}/attendance/summary/${studentId}`),

  // Subject topics
  getSubjectTopics: (subjectId, studentId) =>
    api.get(`${API_ROUTES.STUDENTS}/subjects/${subjectId}/topics`, {
      params: { student_id: studentId },
    }),

  // Video details
  getVideoDetails: (videoId, studentId) =>
    api.get(`${API_ROUTES.STUDENTS}/videos/${videoId}`, {
      params: { student_id: studentId },
    }),

  // Track video event
  trackVideoEvent: (sessionId, eventType, timestampInVideo) =>
    api.post(`${API_ROUTES.STUDENTS}/videos/track-event`, {
      session_id: sessionId,
      event_type: eventType,
      timestamp_in_video: timestampInVideo,
    }),

  // Ask Q&A question
  askQuestion: (studentId, videoId, question) =>
    api.post(`${API_ROUTES.QA}/ask`, {
      student_id: studentId,
      video_id: videoId,
      question,
    }),

  // Student profile — backed by /auth/profile/:id
  getProfile: (studentId) =>
    api.get(`${API_ROUTES.AUTH}/me`, { params: { user_id: studentId } }),

  updateProfile: (studentId, data) =>
    api.put(`${API_ROUTES.AUTH}/profile/${studentId}`, data),

  // Change password — POST /auth/password/change
  changePassword: (userId, oldPassword, newPassword) =>
    api.post(`${API_ROUTES.AUTH}/password/change`, {
      user_id: userId,
      old_password: oldPassword,
      new_password: newPassword,
    }),

  // Enrollment details
  getEnrollment: (studentId) =>
    api.get(`${API_ROUTES.STUDENTS}/enrollment/${studentId}`),

  // Student Health Score
  getSHS: () =>
    api.get(`${API_ROUTES.STUDENTS}/learning/shs`),
};

export default studentService;
