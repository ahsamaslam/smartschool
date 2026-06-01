import api from "../api";

const learningService = {
  getLearningTree: () => api.get(`/students/learning/tree`),

  getStudentTopic: (topicId) => api.get(`/students/learning/topics/${topicId}`),

  getTopicNavigation: (topicId) =>
    api.get(`/students/learning/topics/${topicId}/navigation`),

  updateProgress: (data) => api.post(`/students/learning/progress`, data),

  listProgress: () => api.get(`/students/learning/progress`),

  listMyExams: () => api.get(`/students/learning/exams`),

  getGroupedExams: () => api.get(`/students/learning/exams/grouped`),

  getStudentExam: (examId) => api.get(`/students/learning/exams/${examId}`),

  startExam: (examId) => api.post(`/students/learning/exams/${examId}/start`),

  submitExam: (examId) => api.post(`/students/learning/exams/${examId}/submit`),

  getDashboardSummary: () => api.get(`/students/learning/summary`),

  getSHS: () => api.get(`/students/learning/shs`),
};

export default learningService;
