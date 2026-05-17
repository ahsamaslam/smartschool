import api from "../api";

const videoService = {
  getVideoDetails: (videoId, studentId) =>
    api.get(`/students/videos/${videoId}`, {
      params: { student_id: studentId },
    }),

  trackVideoEvent: (sessionId, eventType, timestampInVideo) =>
    api.post(`/students/videos/track-event`, {
      session_id: sessionId,
      event_type: eventType,
      timestamp_in_video: timestampInVideo,
    }),
};

export default videoService;
