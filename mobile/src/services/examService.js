import api from "../api";

const examService = {
  // Student-facing endpoints
  getMyScheduledExams: () => api.get(`/exams/student/my-exams`),

  // Student exam from learning module (enrolled scope)
  listMyExams: () => api.get(`/students/learning/exams`),
  getGroupedExams: () => api.get(`/students/learning/exams/grouped`),
  getStudentExam: (examId) => api.get(`/students/learning/exams/${examId}`),
  startExam: (examId) => api.post(`/students/learning/exams/${examId}/start`),
  submitExam: (examId) => api.post(`/students/learning/exams/${examId}/submit`),
};

export default examService;
