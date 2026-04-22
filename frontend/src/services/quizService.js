import api from "./api";
import { API_ROUTES } from "../utils/constants";

const quizService = {
  // Get quiz instance with questions
  getInstance: (instanceId) =>
    api.get(`${API_ROUTES.QUIZZES}/instances/${instanceId}`),

  // Start a new attempt
  startAttempt: (studentId, quizInstanceId) =>
    api.post(`${API_ROUTES.QUIZZES}/attempts/start`, null, {
      params: { student_id: studentId, quiz_instance_id: quizInstanceId },
    }),

  // Submit answers
  submitAttempt: (studentId, quizInstanceId, answers) =>
    api.post(`${API_ROUTES.QUIZZES}/attempts/submit`, {
      student_id: studentId,
      quiz_instance_id: quizInstanceId,
      answers,
    }),

  // Get attempt result
  getAttemptResult: (attemptId) =>
    api.get(`${API_ROUTES.QUIZZES}/attempts/${attemptId}/result`),

  // Get attempt count for a quiz instance
  getAttemptCount: (studentId, quizInstanceId) =>
    api.get(`${API_ROUTES.QUIZZES}/attempts/count`, {
      params: { student_id: studentId, quiz_instance_id: quizInstanceId },
    }),
};

export default quizService;
