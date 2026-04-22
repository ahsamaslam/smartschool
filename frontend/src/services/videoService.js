import api from "./api";
import { API_ROUTES } from "../utils/constants";

const videoService = {
  getDetails: (videoId, studentId) =>
    api.get(`${API_ROUTES.STUDENTS}/videos/${videoId}`, {
      params: { student_id: studentId },
    }),

  trackEvent: (sessionId, eventType, timestampInVideo) =>
    api.post(`${API_ROUTES.STUDENTS}/videos/track-event`, {
      session_id: sessionId,
      event_type: eventType,
      timestamp_in_video: Math.round(timestampInVideo),
    }),

  getAnalytics: (videoId) =>
    api.get(`${API_ROUTES.VIDEOS}/analytics/${videoId}`),
};

export default videoService;
