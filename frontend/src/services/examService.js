import api from "./api";
import { API_ROUTES } from "../utils/constants";

const BASE = API_ROUTES.EXAMS;

const examService = {
  // Subjects + topics for a class (for Create modal)
  getClassCurriculum: (classId) =>
    api.get(`${BASE}/class/${classId}/curriculum`),

  /** Board → subject → book → chapter → topics, or flat legacy subjects */
  getClassExamScope: (classId) =>
    api.get(`${BASE}/class/${classId}/exam-scope`),

  /** Teacher/admin: enrolled student count + sample names for exam broadcast preview */
  getEnrollmentPreview: (classId) =>
    api.get(`${BASE}/class/${classId}/enrollment-preview`),

  // List all exams for a teacher
  getExams: (teacherId) =>
    api.get(`${BASE}/`, { params: { teacher_id: teacherId } }),

  // Create AI-generated exam
  createExam: (data) => api.post(`${BASE}/`, data),

  // Get single exam with all questions
  getExam: (examId) => api.get(`${BASE}/${examId}`),

  // Update exam title / status
  updateExam: (examId, data) => api.put(`${BASE}/${examId}`, data),

  // Delete exam
  deleteExam: (examId, teacherId) =>
    api.delete(`${BASE}/${examId}`, { params: { teacher_id: teacherId } }),

  // Regenerate all questions (same settings, new AI call)
  regenerateExam: (examId, teacherId) =>
    api.post(`${BASE}/${examId}/regenerate`, null, {
      params: { teacher_id: teacherId },
    }),

  // Update a single question
  updateQuestion: (examId, questionId, data) =>
    api.put(`${BASE}/${examId}/questions/${questionId}`, data),

  // Delete a single question
  deleteQuestion: (examId, questionId) =>
    api.delete(`${BASE}/${examId}/questions/${questionId}`),

  // Add a manual question
  addQuestion: (examId, data) => api.post(`${BASE}/${examId}/questions`, data),

  // Student submission
  submitExam: (examId, answers) =>
    api.post(`${BASE}/${examId}/submit`, { answers }),
  getMyResult: (examId) => api.get(`${BASE}/${examId}/my-result`),
};

export default examService;
