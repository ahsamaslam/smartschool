import api from "./api";

const API_ROUTES = {
  CHAT: "/chat",
};

const chatService = {
  // Conversations
  listConversations: (page = 1, pageSize = 30) =>
    api.get(`${API_ROUTES.CHAT}/conversations`, {
      params: { page, page_size: pageSize },
    }),

  createConversation: (recipientId, requestMessage = "") =>
    api.post(`${API_ROUTES.CHAT}/conversations`, {
      recipient_id: recipientId,
      request_message: requestMessage,
    }),

  getMessages: (conversationId, page = 1, pageSize = 30) =>
    api.get(`${API_ROUTES.CHAT}/conversations/${conversationId}/messages`, {
      params: { page, page_size: pageSize },
    }),

  sendMessage: (conversationId, content) =>
    api.post(`${API_ROUTES.CHAT}/conversations/${conversationId}/messages`, {
      content,
    }),

  uploadFile: (conversationId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(
      `${API_ROUTES.CHAT}/conversations/${conversationId}/upload`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          return percentCompleted;
        },
      },
    );
  },

  respondToRequest: (conversationId, action) =>
    api.patch(`${API_ROUTES.CHAT}/conversations/${conversationId}/request`, {
      action,
    }),

  updateControls: (conversationId, controls) =>
    api.patch(
      `${API_ROUTES.CHAT}/conversations/${conversationId}/controls`,
      controls,
    ),

  // Teachers / Members
  getEligibleTeachers: () => api.get(`${API_ROUTES.CHAT}/eligible-teachers`),

  searchSchoolMembers: (query = "") =>
    api.get(`${API_ROUTES.CHAT}/school-members`, { params: { q: query } }),

  getPresence: (userId) => api.get(`${API_ROUTES.CHAT}/presence/${userId}`),

  setBusyMode: (acceptNewRequests) =>
    api.patch(`${API_ROUTES.CHAT}/busy-mode`, {
      accept_new_requests: acceptNewRequests,
    }),

  // Announcements
  createAnnouncement: (data) =>
    api.post(`${API_ROUTES.CHAT}/announcements`, data),

  listAnnouncements: () => api.get(`${API_ROUTES.CHAT}/announcements`),

  markAnnouncementRead: (announcementId, acknowledged = false) =>
    api.post(`${API_ROUTES.CHAT}/announcements/${announcementId}/read`, {
      acknowledged,
    }),

  // Unread count
  getUnreadCount: () => api.get(`${API_ROUTES.CHAT}/unread-count`),
};

export default chatService;
