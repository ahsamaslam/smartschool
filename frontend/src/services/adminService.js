import api from "./api";
import { API_ROUTES } from "../utils/constants";

const adminService = {
  // Users
  getUsers: (role) =>
    api.get(`${API_ROUTES.ADMINS}/users`, { params: role ? { role } : {} }),

  createUser: (data) => api.post(`${API_ROUTES.ADMINS}/users`, data),

  assignRole: (userId, newRole) =>
    api.put(`${API_ROUTES.ADMINS}/users/${userId}/role`, {
      user_id: userId,
      new_role: newRole,
    }),

  deactivateUser: (userId) =>
    api.delete(`${API_ROUTES.ADMINS}/users/${userId}`),

  // Schools
  getSchools: () => api.get(`${API_ROUTES.MANAGERS}/schools`),

  createSchool: (data) => api.post(`${API_ROUTES.ADMINS}/schools`, data),

  createBranch: (data) => api.post(`${API_ROUTES.ADMINS}/branches`, data),

  // Curriculum
  getSubjects: () => api.get(`${API_ROUTES.ADMINS}/subjects`),

  getSubjectTopics: (subjectId) =>
    api.get(`${API_ROUTES.ADMINS}/subjects/${subjectId}/topics`),

  createSubject: (data) => api.post(`${API_ROUTES.ADMINS}/subjects`, data),

  createTopic: (data) => api.post(`${API_ROUTES.ADMINS}/topics`, data),

  deleteSubject: (subjectId) =>
    api.delete(`${API_ROUTES.ADMINS}/subjects/${subjectId}`),

  getTopicTemplate: (topicId) =>
    api.get(`${API_ROUTES.ADMINS}/topics/${topicId}/template`),

  updateTopicScript: (topicId, data) =>
    api.put(`${API_ROUTES.ADMINS}/topics/${topicId}/template/script`, data, {
      timeout: 180000,
    }),

  // AI Curriculum
  parseCurriculumBook: (formData) =>
    api.post(`${API_ROUTES.ADMINS}/curriculum/parse-book`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    }),

  saveParsedCurriculum: (data) =>
    api.post(`${API_ROUTES.ADMINS}/curriculum/save-parsed`, data),

  generateTopicVideo: (data) =>
    api.post(`${API_ROUTES.ADMINS}/curriculum/generate-video`, data, {
      timeout: 60000,
    }),

  generateTopicAudio: (data) =>
    api.post(`${API_ROUTES.ADMINS}/curriculum/generate-audio`, data, {
      timeout: 60000,
    }),

  generateWhiteboardVideo: (data) =>
    api.post(`${API_ROUTES.ADMINS}/curriculum/generate-whiteboard`, data, {
      timeout: 300000, // rendering can take up to 5 min for long scripts
    }),

  generateDIDAvatar: (data) =>
    api.post(`${API_ROUTES.ADMINS}/curriculum/generate-avatar`, data, {
      timeout: 600000, // Wav2Lip GPU inference: up to 10 min
    }),

  compositeVideo: (data) =>
    api.post(`${API_ROUTES.ADMINS}/curriculum/composite-video`, data, {
      timeout: 180000, // FFmpeg compositing up to 3 min
    }),

  compositeTeacherPip: (formData) =>
    api.post(
      `${API_ROUTES.ADMINS}/curriculum/composite-teacher-pip`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600000, // FFmpeg + large video upload: up to 10 min
      },
    ),

  // Topic content & slides
  updateTopic: (topicId, data) =>
    api.put(`${API_ROUTES.ADMINS}/topics/${topicId}`, data),
  getTopicSlides: (topicId) =>
    api.get(`${API_ROUTES.ADMINS}/topics/${topicId}/slides`),
  saveTopicSlides: (topicId, data) =>
    api.put(`${API_ROUTES.ADMINS}/topics/${topicId}/slides`, data),
  generateTopicContent: (topicId) =>
    api.post(`${API_ROUTES.ADMINS}/topics/${topicId}/generate-content`, null, {
      timeout: 120000, // Claude generation up to 2 min
    }),

  // Videos
  getVideoTemplates: () => api.get(`${API_ROUTES.ADMINS}/videos/templates`),

  createVideoTemplate: (adminId, data) =>
    api.post(`${API_ROUTES.ADMINS}/videos/templates`, null, {
      params: { admin_id: adminId, ...data },
    }),

  updateVideoTemplate: (templateId, data) =>
    api.put(`${API_ROUTES.ADMINS}/videos/templates/${templateId}`, null, {
      params: data,
    }),

  // Train Model (pushes curriculum context to Claude)
  trainModel: (scope) => api.post(`${API_ROUTES.ADMINS}/ai/train`, scope),
};

export default adminService;
