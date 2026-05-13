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

  /** AI-generated draft (title, instructions, questions) — not saved until teacher saves draft */
  aiGenerateDraft: (data) => api.post(`${BASE}/ai/generate-draft`, data),

  create: (data) => api.post(BASE, data),

  update: (homeworkId, data) => api.patch(`${BASE}/${homeworkId}`, data),

  replaceQuestions: (homeworkId, questions) =>
    api.put(`${BASE}/${homeworkId}/questions`, { questions }),

  publish: (homeworkId) => api.post(`${BASE}/${homeworkId}/publish`),

  gradeSubmission: (submissionId, data) =>
    api.patch(`${BASE}/submissions/${submissionId}`, data),

  remove: (homeworkId) => api.delete(`${BASE}/${homeworkId}`),

  studentList: () => api.get(`${BASE}/student/list`),

  /** Admin-only: same payload as student list for enrollment + curriculum visibility checks */
  adminStudentHomeworkList: (studentId) =>
    api.get(`${BASE}/admin/student/${studentId}/homework-list`),

  studentGet: (homeworkId) => api.get(`${BASE}/student/${homeworkId}`),

  submitInteractive: (homeworkId, answers) =>
    api.post(`${BASE}/student/${homeworkId}/submit-interactive`, { answers }),

  saveProgress: (homeworkId, answers) =>
    api.post(`${BASE}/student/${homeworkId}/save-progress`, { answers }),

  submitUpload: (homeworkId, files) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    return api.post(`${BASE}/student/${homeworkId}/submit-upload`, form);
  },
};

export default homeworkService;
