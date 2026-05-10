import api from "./api";
import { API_ROUTES } from "../utils/constants";

const BASE = API_ROUTES.STUDENTS;

/** Enrollment-scoped curriculum trees + guarded topic payloads */
const learningService = {
  getLearningTree: () => api.get(`${BASE}/learning/tree`),

  getStudentTopic: (topicId) =>
    api.get(`${BASE}/learning/topics/${topicId}`),

  getTopicNavigation: (topicId) =>
    api.get(`${BASE}/learning/topics/${topicId}/navigation`),

  updateProgress: (data) => api.post(`${BASE}/learning/progress`, data),

  listProgress: () => api.get(`${BASE}/learning/progress`),

  listMyExams: () => api.get(`${BASE}/learning/exams`),

  getGroupedExams: () => api.get(`${BASE}/learning/exams/grouped`),

  getStudentExam: (examId) => api.get(`${BASE}/learning/exams/${examId}`),

  startExam: (examId) =>
    api.post(`${BASE}/learning/exams/${examId}/start`),

  submitExam: (examId) =>
    api.post(`${BASE}/learning/exams/${examId}/submit`),

  getDashboardSummary: () => api.get(`${BASE}/learning/summary`),
};

export default learningService;
