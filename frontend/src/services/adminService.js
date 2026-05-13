import api from "./api";
import { API_ROUTES } from "../utils/constants";

const adminService = {
  // Users
  getUsers: (role, axiosConfig = {}) =>
    api.get(`${API_ROUTES.ADMINS}/users`, {
      ...(axiosConfig || {}),
      params: {
        ...(role ? { role } : {}),
        ...(axiosConfig.params || {}),
      },
    }),
  getStudentsLedger: () => api.get(`${API_ROUTES.ADMINS}/students`),
  getStudentDetail: (studentId) => api.get(`${API_ROUTES.ADMINS}/students/${studentId}`),
  createStudent: (data) => api.post(`${API_ROUTES.ADMINS}/students`, data),
  promoteStudent: (studentId, data) => api.post(`${API_ROUTES.ADMINS}/students/${studentId}/promote`, data),
  repeatStudent: (studentId, data) => api.post(`${API_ROUTES.ADMINS}/students/${studentId}/repeat`, data),
  changeStudentSection: (studentId, data) => api.post(`${API_ROUTES.ADMINS}/students/${studentId}/change-section`, data),
  getStudentSectionOptions: (studentId) => api.get(`${API_ROUTES.ADMINS}/students/${studentId}/section-options`),
  setCurrentEnrollment: (studentId, data) => api.post(`${API_ROUTES.ADMINS}/students/${studentId}/set-current-enrollment`, data),
  archiveStudent: (studentId) => api.delete(`${API_ROUTES.ADMINS}/students/${studentId}`),
  updateStudent: (studentId, data) => api.patch(`${API_ROUTES.ADMINS}/students/${studentId}`, data),
  setStudentPassword: (studentId, password) =>
    api.post(`${API_ROUTES.ADMINS}/users/${studentId}/set-password`, { password }),

  createUser: (data) => api.post(`${API_ROUTES.ADMINS}/users`, data),
  updateUser: (userId, data) => api.put(`${API_ROUTES.ADMINS}/users/${userId}`, data),
  setUserPassword: (userId, password) =>
    api.post(`${API_ROUTES.ADMINS}/users/${userId}/set-password`, { password }),

  assignRole: (userId, newRole) =>
    api.put(`${API_ROUTES.ADMINS}/users/${userId}/role`, {
      user_id: userId,
      new_role: newRole,
    }),

  deactivateUser: (userId) =>
    api.delete(`${API_ROUTES.ADMINS}/users/${userId}`),
  activateUser: (userId) =>
    api.post(`${API_ROUTES.ADMINS}/users/${userId}/activate`),

  // Schools
  getSchools: () => api.get(`${API_ROUTES.ADMINS}/schools`),
  getAllSchoolData: (axiosConfig = {}) =>
    api.get(`${API_ROUTES.ADMINS}/schools/all-data`, axiosConfig),

  createSchool: (data) => api.post(`${API_ROUTES.ADMINS}/schools`, data),
  updateSchool: (schoolId, data) => api.put(`${API_ROUTES.ADMINS}/schools/${schoolId}`, data),
  deleteSchool: (schoolId) => api.delete(`${API_ROUTES.ADMINS}/schools/${schoolId}`),
  createSchoolManager: (schoolId, data) => api.post(`${API_ROUTES.ADMINS}/schools/${schoolId}/manager`, data),

  getSchoolBranches: (schoolId) =>
    api.get(`${API_ROUTES.ADMINS}/schools/${schoolId}/branches`),

  createBranch: (data) => api.post(`${API_ROUTES.ADMINS}/branches`, data),
  updateBranch: (branchId, data) => api.put(`${API_ROUTES.ADMINS}/branches/${branchId}`, data),
  deleteBranch: (branchId) => api.delete(`${API_ROUTES.ADMINS}/branches/${branchId}`),

  getBranchClasses: (branchId) =>
    api.get(`${API_ROUTES.ADMINS}/branches/${branchId}/classes`),

  getClasses: () => api.get(`${API_ROUTES.ADMINS}/classes`),

  createClass: (data) => api.post(`${API_ROUTES.ADMINS}/classes`, data),
  updateClass: (classId, data) => api.put(`${API_ROUTES.ADMINS}/classes/${classId}`, data),
  deleteClass: (classId) => api.delete(`${API_ROUTES.ADMINS}/classes/${classId}`),

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
  parseBookMetadata: (formData) =>
    api.post(`${API_ROUTES.ADMINS}/curriculum/parse-metadata`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    }),

  parseCurriculumBook: (formData) =>
    api.post(`${API_ROUTES.ADMINS}/curriculum/parse-book`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000, // 5 minutes — AI parsing can be slow for large PDFs
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

  // Design Templates
  getDesignTemplates: (category = null, activeOnly = true) =>
    api.get(`${API_ROUTES.ADMINS}/templates`, {
      params: { category, active_only: activeOnly },
    }),

  createDesignTemplate: (data) =>
    api.post(`${API_ROUTES.ADMINS}/templates`, data),

  updateDesignTemplate: (templateId, data) =>
    api.put(`${API_ROUTES.ADMINS}/templates/${templateId}`, data),

  deleteDesignTemplate: (templateId) =>
    api.delete(`${API_ROUTES.ADMINS}/templates/${templateId}`),

  applyTemplateToTopic: (templateId, topicId) =>
    api.post(`${API_ROUTES.ADMINS}/templates/${templateId}/apply`, {
      topic_id: topicId,
      design_template_id: templateId,
    }),

  seedDefaultTemplates: () =>
    api.post(`${API_ROUTES.ADMINS}/templates/seed`),

  /** Structured slide deck (Claude when configured, mock fallback). */
  generateAISlides: (data) =>
    api.post(`${API_ROUTES.ADMINS}/generate-slides`, data, {
      timeout: 120000,
    }),

  // Train Model (pushes curriculum context to Claude)
  trainModel: (scope) => api.post(`${API_ROUTES.ADMINS}/ai/train`, scope),
};

export default adminService;
