import api from "./api";
import { API_ROUTES } from "../utils/constants";

const managerService = {
  // Schools
  getSchools: () => api.get(`${API_ROUTES.MANAGERS}/schools`),

  getSchoolBranches: (schoolId) =>
    api.get(`${API_ROUTES.MANAGERS}/schools/${schoolId}/branches`),

  getBranchOverview: (branchId) =>
    api.get(`${API_ROUTES.MANAGERS}/branches/${branchId}/overview`),

  // Reports — "From Beginning" sends no start_date (period = 'all')
  getStudentReports: (filters) =>
    api.get(`${API_ROUTES.MANAGERS}/reports/students`, { params: filters }),

  getClassReports: (filters) =>
    api.get(`${API_ROUTES.MANAGERS}/reports/classes`, { params: filters }),

  getTeacherReports: (filters) =>
    api.get(`${API_ROUTES.MANAGERS}/reports/teachers`, { params: filters }),
};

export default managerService;
