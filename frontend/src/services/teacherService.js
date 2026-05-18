import api from "./api";
import { API_ROUTES } from "../utils/constants";

const teacherService = {
  // Dashboard summary
  getDashboard: (teacherId) =>
    api.get(`${API_ROUTES.TEACHERS}/dashboard/${teacherId}`),

  // Classes
  getClasses: (teacherId) =>
    api.get(`${API_ROUTES.TEACHERS}/classes/${teacherId}`),

  /** Subject/book slots assigned to this teacher for a section */
  getTeachingAssignments: (classId, axiosConfig = {}) =>
    api.get(
      `${API_ROUTES.TEACHERS}/classes/${classId}/teaching-assignments`,
      axiosConfig,
    ),

  createClass: (teacherId, data) =>
    api.post(`${API_ROUTES.TEACHERS}/classes`, data, {
      params: { teacher_id: teacherId },
    }),

  getClassStudents: (classId, teacherId) =>
    api.get(`${API_ROUTES.TEACHERS}/classes/${classId}/students`, {
      params: teacherId ? { teacher_id: teacherId } : {},
    }),

  addStudentToClass: (classId, data) =>
    api.post(`${API_ROUTES.TEACHERS}/classes/${classId}/students`, data),

  // Student detail
  getStudentPerformance: (studentId, classId, teacherId) =>
    api.get(`${API_ROUTES.TEACHERS}/students/${studentId}/performance`, {
      params: { class_id: classId, ...(teacherId ? { teacher_id: teacherId } : {}) },
    }),

  sendPasswordReset: (studentId) =>
    api.post(`${API_ROUTES.TEACHERS}/students/${studentId}/password-reset`),

  // Attendance
  markAttendance: (teacherId, data, allowEdit = false) =>
    api.post(`${API_ROUTES.TEACHERS}/attendance`, data, {
      params: { teacher_id: teacherId, allow_edit: allowEdit },
    }),

  getAttendance: (classId, dateFrom, dateTo) =>
    api.get(`${API_ROUTES.TEACHERS}/attendance/${classId}`, {
      params: { date_from: dateFrom, date_to: dateTo },
    }),

  // Video publishing
  getVideoTemplates: () => api.get(`${API_ROUTES.TEACHERS}/videos/templates`),

  getAvatars: (teacherId) =>
    api.get(`${API_ROUTES.TEACHERS}/avatars/${teacherId}`),

  publishVideo: (teacherId, data) =>
    api.post(`${API_ROUTES.TEACHERS}/videos/publish`, data, {
      params: { teacher_id: teacherId },
    }),

  // Avatar photo upload + regeneration
  regenerateAvatar: (teacherId, templateId, photoFile) => {
    const form = new FormData();
    form.append("photo", photoFile);
    return api.post(
      `${API_ROUTES.TEACHERS}/videos/${templateId}/regenerate-avatar`,
      form,
      {
        params: { teacher_id: teacherId },
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000, // 5 min — Wav2Lip takes ~45s
      },
    );
  },

  // Exam generation
  generateExam: (teacherId, data) =>
    api.post(`${API_ROUTES.TEACHERS}/exams/generate`, data, {
      params: { teacher_id: teacherId },
    }),

  // Teacher curriculum (My Books)
  getMyCurriculum: () => api.get(`${API_ROUTES.TEACHERS}/my-curriculum`),
  getTeacherBook: (bookId) => api.get(`${API_ROUTES.TEACHERS}/books/${bookId}`),

  // AI Slide generation (no admin permission required)
  generateAISlides: (data) =>
    api.post(`${API_ROUTES.TEACHERS}/generate-slides`, data, {
      timeout: 120000,
    }),

  // Teacher-specific topic content (slides + lectures — isolated per teacher)
  getMyTopicContent: (topicId) =>
    api.get(`${API_ROUTES.TEACHERS}/topics/${topicId}/my-content`),

  saveMyTopicSlides: (topicId, data) =>
    api.put(`${API_ROUTES.TEACHERS}/topics/${topicId}/slides`, data),

  uploadMyTopicLecture: (topicId, formData) =>
    api.post(`${API_ROUTES.TEACHERS}/topics/${topicId}/lecture`, formData, {
      timeout: 600000,
    }),

  deleteMyTopicLecture: (topicId) =>
    api.delete(`${API_ROUTES.TEACHERS}/topics/${topicId}/lecture`),

  deleteMyTopicSlides: (topicId) =>
    api.delete(`${API_ROUTES.TEACHERS}/topics/${topicId}/slides`),

  listMyLectures: (params = {}) =>
    api.get(`${API_ROUTES.TEACHERS}/my-lectures`, { params }),

  getMyContentStatusForBook: (bookId) =>
    api.get(`${API_ROUTES.TEACHERS}/my-content-status/book/${bookId}`),

  // Analytics (SHS / CVI)
  getAnalyticsOverview: (period = "last_month", start, end) =>
    api.get(`${API_ROUTES.TEACHERS}/analytics/overview`, {
      params: { period, ...(start && { start }), ...(end && { end }) },
    }),

  getClassAnalytics: (classId, period = "last_month", start, end) =>
    api.get(`${API_ROUTES.TEACHERS}/analytics/class/${classId}`, {
      params: { period, ...(start && { start }), ...(end && { end }) },
    }),

  getStudentAnalytics: (
    studentId,
    classId,
    period = "last_month",
    start,
    end,
  ) =>
    api.get(`${API_ROUTES.TEACHERS}/analytics/student/${studentId}`, {
      params: {
        class_id: classId,
        period,
        ...(start && { start }),
        ...(end && { end }),
      },
    }),

  // Historical Metrics & Alerts
  getStudentHistoricalMetrics: (studentId, classId, days = 30) =>
    api.get(`${API_ROUTES.METRICS}/student/${studentId}/historical`, {
      params: { class_id: classId, days },
    }),

  getClassAlerts: (classId, params = {}) =>
    api.get(`${API_ROUTES.METRICS}/class/${classId}/alerts`, { params }),

  getClassRiskSummary: (classId) =>
    api.get(`${API_ROUTES.METRICS}/class/${classId}/risk-summary`),

  resolveAlert: (alertId) =>
    api.post(`${API_ROUTES.METRICS}/alert/${alertId}/resolve`),

  getStudentAIPrediction: (studentId, classId) =>
    api.get(`${API_ROUTES.METRICS}/student/${studentId}/ai-prediction`, {
      params: { class_id: classId },
    }),
};

export default teacherService;
