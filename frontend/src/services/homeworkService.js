import api from "./api";

const BASE = "homework";

const homeworkService = {
  teacherList: (params) => api.get(BASE + "/teacher/list", { params }),

  /** Library tree for homework topic picker, filtered to teacher assignments when configured */
  getTeacherCurriculum: (teacherId, classId) =>
    api.get(`${BASE}/teacher/${teacherId}/curriculum/${classId}`),

  teacherGet: (homeworkId) => api.get(`${BASE}/teacher/${homeworkId}`),

  teacherSubmissions: (homeworkId) =>
    api.get(`${BASE}/teacher/${homeworkId}/submissions`),

  create: (data) => api.post(BASE, data),

  update: (homeworkId, data) => api.patch(`${BASE}/${homeworkId}`, data),

  replaceQuestions: (homeworkId, questions) =>
    api.put(`${BASE}/${homeworkId}/questions`, { questions }),

  publish: (homeworkId) => api.post(`${BASE}/${homeworkId}/publish`),

  gradeSubmission: (submissionId, data) =>
    api.patch(`${BASE}/submissions/${submissionId}`, data),

  remove: (homeworkId) => api.delete(`${BASE}/${homeworkId}`),

  studentList: () => api.get(`${BASE}/student/list`),

  studentGet: (homeworkId) => api.get(`${BASE}/student/${homeworkId}`),

  submitInteractive: (homeworkId, answers) =>
    api.post(`${BASE}/student/${homeworkId}/submit-interactive`, { answers }),

  submitUpload: (homeworkId, files) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    return api.post(`${BASE}/student/${homeworkId}/submit-upload`, form);
  },
};

export default homeworkService;
