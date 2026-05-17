import api from "../api";

const quizService = {
  getInstance: (instanceId) => api.get(`/quizzes/instances/${instanceId}`),

  startAttempt: (studentId, quizInstanceId) =>
    api.post(`/quizzes/attempts/start`, null, {
      params: { student_id: studentId, quiz_instance_id: quizInstanceId },
    }),

  submitAttempt: (studentId, quizInstanceId, answers) =>
    api.post(`/quizzes/attempts/submit`, {
      student_id: studentId,
      quiz_instance_id: quizInstanceId,
      answers,
    }),

  getAttemptResult: (attemptId) =>
    api.get(`/quizzes/attempts/${attemptId}/result`),

  getAttemptCount: (studentId, quizInstanceId) =>
    api.get(`/quizzes/attempts/count`, {
      params: { student_id: studentId, quiz_instance_id: quizInstanceId },
    }),
};

export default quizService;
