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

  getClassStudents: (classId) =>
    api.get(`${API_ROUTES.TEACHERS}/classes/${classId}/students`),

  addStudentToClass: (classId, data) =>
    api.post(`${API_ROUTES.TEACHERS}/classes/${classId}/students`, data),

  // Student detail
  getStudentPerformance: (studentId, classId) =>
    api.get(`${API_ROUTES.TEACHERS}/students/${studentId}/performance`, {
      params: { class_id: classId },
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
};

export default teacherService;
