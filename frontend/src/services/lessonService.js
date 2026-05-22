import api from "./api";
import { API_ROUTES } from "../utils/constants";

const lessonService = {
  // Create lesson plan
  createLessonPlan: (data) =>
    api.post(`${API_ROUTES.TEACHERS}/lessons`, data),

  // Get single lesson plan
  getLessonPlan: (lessonId) =>
    api.get(`${API_ROUTES.TEACHERS}/lessons/${lessonId}`),

  // List teacher's lesson plans with filters
  getLessonPlans: (teacherId, dateFrom, dateTo, classId, status, page = 1, limit = 50) =>
    api.get(`${API_ROUTES.TEACHERS}/lessons/teacher/${teacherId}`, {
      params: {
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
        ...(classId && { class_id: classId }),
        ...(status && { status }),
        page,
        limit,
      },
    }),

  // Get calendar data for month view
  getCalendarView: (teacherId, yearMonth) =>
    api.get(`${API_ROUTES.TEACHERS}/lessons/calendar/${teacherId}`, {
      params: { year_month: yearMonth },
    }),

  // Update lesson plan
  updateLessonPlan: (lessonId, data) =>
    api.put(`${API_ROUTES.TEACHERS}/lessons/${lessonId}`, data),

  // Delete lesson plan
  deleteLessonPlan: (lessonId) =>
    api.delete(`${API_ROUTES.TEACHERS}/lessons/${lessonId}`),

  // Mark lesson as completed
  markLessonComplete: (lessonId) =>
    api.post(`${API_ROUTES.TEACHERS}/lessons/${lessonId}/mark-complete`),

  // Get syllabus coverage statistics
  getSyllabusCoverage: (teacherId, classId, librarySubjectId) =>
    api.get(`${API_ROUTES.TEACHERS}/lessons/${teacherId}/syllabus-coverage`, {
      params: {
        ...(classId && { class_id: classId }),
        ...(librarySubjectId && { library_subject_id: librarySubjectId }),
      },
    }),
};

export default lessonService;
