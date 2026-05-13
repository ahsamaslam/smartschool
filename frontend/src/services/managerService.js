import api from "./api";
import { API_ROUTES } from "../utils/constants";

const managerService = {
  // Schools
  getSchools: () => api.get(`${API_ROUTES.MANAGERS}/schools`),
  getSchoolBranches: (schoolId) =>
    api.get(`${API_ROUTES.MANAGERS}/schools/${schoolId}/branches`),
  getBranchOverview: (branchId) =>
    api.get(`${API_ROUTES.MANAGERS}/branches/${branchId}/overview`),

  // Teachers
  getTeachers: () => api.get(`${API_ROUTES.MANAGERS}/teachers`),
  createTeacher: (data) => api.post(`${API_ROUTES.MANAGERS}/teachers`, data),
  updateTeacher: (teacherId, data) => api.put(`${API_ROUTES.MANAGERS}/teachers/${teacherId}`, data),
  deleteTeacher: (teacherId) => api.post(`${API_ROUTES.MANAGERS}/teachers/${teacherId}/remove`),
  deleteTeachers: (teacherIds) => api.post(`${API_ROUTES.MANAGERS}/teachers/bulk-remove`, { teacher_ids: teacherIds }),
  importTeachers: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`${API_ROUTES.MANAGERS}/import-teachers`, formData);
  },
  assignTeacherClass: (teacherId, classId) =>
    api.post(`${API_ROUTES.MANAGERS}/teachers/${teacherId}/assign-class`, { class_id: classId }),

  // Students
  getStudents: (params) =>
    api.get(`${API_ROUTES.MANAGERS}/students`, { params }),

  // Classes
  getClasses: (params) =>
    api.get(`${API_ROUTES.MANAGERS}/classes`, { params }),
  createClass: (data) => api.post(`${API_ROUTES.MANAGERS}/classes`, data),

  // Reports
  getStudentReports: (filters) =>
    api.get(`${API_ROUTES.MANAGERS}/reports/students`, { params: filters }),
  getClassReports: (filters) =>
    api.get(`${API_ROUTES.MANAGERS}/reports/classes`, { params: filters }),
  getTeacherReports: (filters) =>
    api.get(`${API_ROUTES.MANAGERS}/reports/teachers`, { params: filters }),
};

export default managerService;
