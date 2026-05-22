import api from "./api";
import { API_ROUTES } from "../utils/constants";

const managerService = {
  // Schools
  getSchools: () => api.get(`${API_ROUTES.MANAGERS}/schools`),
  getUsers: (params) => api.get(`${API_ROUTES.MANAGERS}/users`, { params }),
  createUser: (data) => api.post(`${API_ROUTES.MANAGERS}/users`, data),
  deactivateUser: (userId) =>
    api.delete(`${API_ROUTES.MANAGERS}/users/${userId}`),
  activateUser: (userId) =>
    api.post(`${API_ROUTES.MANAGERS}/users/${userId}/activate`),
  resetUserTemporaryPassword: (userId) =>
    api.post(`${API_ROUTES.MANAGERS}/users/${userId}/temporary-password`),
  getSchoolBranches: (schoolId) =>
    api.get(`${API_ROUTES.MANAGERS}/schools/${schoolId}/branches`),
  getBranchOverview: (branchId) =>
    api.get(`${API_ROUTES.MANAGERS}/branches/${branchId}/overview`),

  // Teachers
  getTeachers: () => api.get(`${API_ROUTES.MANAGERS}/teachers`),
  createTeacher: (data) => api.post(`${API_ROUTES.MANAGERS}/teachers`, data),
  updateTeacher: (teacherId, data) =>
    api.put(`${API_ROUTES.MANAGERS}/teachers/${teacherId}`, data),
  deleteTeacher: (teacherId) =>
    api.post(`${API_ROUTES.MANAGERS}/teachers/${teacherId}/remove`),
  deleteTeachers: (teacherIds) =>
    api.post(`${API_ROUTES.MANAGERS}/teachers/bulk-remove`, {
      teacher_ids: teacherIds,
    }),
  importTeachers: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`${API_ROUTES.MANAGERS}/import-teachers`, formData);
  },
  downloadTeacherImportTemplate: () =>
    api.get(`${API_ROUTES.MANAGERS}/teachers/import-template`, {
      responseType: "blob",
    }),
  assignTeacherClass: (teacherId, classId) =>
    api.post(`${API_ROUTES.MANAGERS}/teachers/${teacherId}/assign-class`, {
      class_id: classId,
    }),
  getTeacherAssignments: (teacherId) =>
    api.get(`${API_ROUTES.MANAGERS}/teachers/${teacherId}/assignments`),
  saveTeacherAssignments: (teacherId, data) =>
    api.post(
      `${API_ROUTES.MANAGERS}/teachers/${teacherId}/save-assignments`,
      data,
    ),

  // Students
  getStudents: (params) =>
    api.get(`${API_ROUTES.MANAGERS}/students`, { params }),
  getStudentDetail: (studentId) =>
    api.get(`${API_ROUTES.MANAGERS}/students/${studentId}`),
  createStudent: (data) => api.post(`${API_ROUTES.MANAGERS}/students`, data),
  updateStudent: (studentId, data) =>
    api.patch(`${API_ROUTES.MANAGERS}/students/${studentId}`, data),
  deleteStudent: (studentId) =>
    api.delete(`${API_ROUTES.MANAGERS}/students/${studentId}`),
  promoteStudent: (studentId, data) =>
    api.post(`${API_ROUTES.MANAGERS}/students/${studentId}/promote`, data),
  repeatStudent: (studentId, data) =>
    api.post(`${API_ROUTES.MANAGERS}/students/${studentId}/repeat`, data),
  changeStudentSection: (studentId, data) =>
    api.post(
      `${API_ROUTES.MANAGERS}/students/${studentId}/change-section`,
      data,
    ),
  getStudentSectionOptions: (studentId) =>
    api.get(`${API_ROUTES.MANAGERS}/students/${studentId}/section-options`),
  setCurrentEnrollment: (studentId, data) =>
    api.post(
      `${API_ROUTES.MANAGERS}/students/${studentId}/set-current-enrollment`,
      data,
    ),
  setStudentPassword: (studentId, password) =>
    api.post(`${API_ROUTES.MANAGERS}/users/${studentId}/set-password`, {
      password,
    }),
  importStudents: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`${API_ROUTES.MANAGERS}/import-students`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  downloadStudentImportTemplate: () =>
    api.get(`${API_ROUTES.MANAGERS}/students/import-template`, {
      responseType: "blob",
    }),

  // Branches
  createBranch: (data) => api.post(`${API_ROUTES.MANAGERS}/branches`, data),
  updateBranch: (branchId, data) =>
    api.put(`${API_ROUTES.MANAGERS}/branches/${branchId}`, data),
  deleteBranch: (branchId) =>
    api.delete(`${API_ROUTES.MANAGERS}/branches/${branchId}`),

  // Classes
  getClasses: (params) => api.get(`${API_ROUTES.MANAGERS}/classes`, { params }),
  createClass: (data) => api.post(`${API_ROUTES.MANAGERS}/classes`, data),
  updateClass: (classId, data) =>
    api.put(`${API_ROUTES.MANAGERS}/classes/${classId}`, data),
  deleteClass: (classId) =>
    api.delete(`${API_ROUTES.MANAGERS}/classes/${classId}`,),

  // Reports
  getStudentReports: (filters) =>
    api.get(`${API_ROUTES.MANAGERS}/reports/students`, { params: filters }),
  getClassReports: (filters) =>
    api.get(`${API_ROUTES.MANAGERS}/reports/classes`, { params: filters }),
  getTeacherReports: (filters) =>
    api.get(`${API_ROUTES.MANAGERS}/reports/teachers`, { params: filters }),

  // Analytics (SPI / CVI / SHS)
  getAnalyticsOverview: (period = "last_month", start, end) =>
    api.get(`${API_ROUTES.MANAGERS}/analytics/overview`, {
      params: { period, ...(start && { start }), ...(end && { end }) },
    }),

  getTeacherAnalytics: (period = "last_month", start, end) =>
    api.get(`${API_ROUTES.MANAGERS}/analytics/teachers`, {
      params: { period, ...(start && { start }), ...(end && { end }) },
    }),

  getClassAnalytics: (period = "last_month", start, end) =>
    api.get(`${API_ROUTES.MANAGERS}/analytics/classes`, {
      params: { period, ...(start && { start }), ...(end && { end }) },
    }),

  getStudentAnalytics: (studentId, period = "last_month", start, end) =>
    api.get(`${API_ROUTES.MANAGERS}/analytics/student/${studentId}`, {
      params: { period, ...(start && { start }), ...(end && { end }) },
    }),

  // Curriculum (linking subjects/books to sections)
  getSectionSubjectCatalog: (sectionId) =>
    api.get(`${API_ROUTES.MANAGERS}/sections/${sectionId}/subject-catalog`),
  getSectionCurriculum: (sectionId) =>
    api.get(`${API_ROUTES.MANAGERS}/sections/${sectionId}/curriculum`),
  saveSectionCurriculum: (sectionId, data) =>
    api.post(`${API_ROUTES.MANAGERS}/sections/${sectionId}/curriculum`, data),

  // AI Predictions
  getAIPredictions: (entityType, entityId) =>
    api.get(`/analytics/insights/${entityType}/${entityId}`),

  // Manager chapter management (create, edit, delete approved chapters)
  addChapter: (bookId, data) =>
    api.post(`${API_ROUTES.MANAGERS}/chapters/${bookId}`, data),

  editChapter: (chapterId, data) =>
    api.put(`${API_ROUTES.MANAGERS}/chapters/${chapterId}`, data),

  deleteChapter: (chapterId) =>
    api.delete(`${API_ROUTES.MANAGERS}/chapters/${chapterId}`),
};

export default managerService;
