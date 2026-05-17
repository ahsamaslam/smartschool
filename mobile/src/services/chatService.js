import api from "../api";

const chatService = {
  listConversations: (page = 1, pageSize = 30) =>
    api.get(`/chat/conversations`, {
      params: { page, page_size: pageSize },
    }),

  createConversation: (recipientId, requestMessage = "") =>
    api.post(`/chat/conversations`, {
      recipient_id: recipientId,
      request_message: requestMessage,
    }),

  getMessages: (conversationId, page = 1, pageSize = 30) =>
    api.get(`/chat/conversations/${conversationId}/messages`, {
      params: { page, page_size: pageSize },
    }),

  sendMessage: (conversationId, content) =>
    api.post(`/chat/conversations/${conversationId}/messages`, { content }),

  uploadFile: (conversationId, fileAsset) => {
    const formData = new FormData();
    formData.append("file", {
      uri: fileAsset.uri,
      name: fileAsset.name ?? "upload",
      type: fileAsset.mimeType ?? "application/octet-stream",
    });
    return api.post(`/chat/conversations/${conversationId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  respondToRequest: (conversationId, action) =>
    api.patch(`/chat/conversations/${conversationId}/request`, { action }),

  updateControls: (conversationId, controls) =>
    api.patch(`/chat/conversations/${conversationId}/controls`, controls),

  getEligibleTeachers: () => api.get(`/chat/eligible-teachers`),
  getEligibleContacts: () => api.get(`/chat/eligible-contacts`),

  searchSchoolMembers: (query = "") =>
    api.get(`/chat/school-members`, { params: { q: query } }),

  getPresence: (userId) => api.get(`/chat/presence/${userId}`),

  setBusyMode: (acceptNewRequests) =>
    api.patch(`/chat/busy-mode`, { accept_new_requests: acceptNewRequests }),

  createAnnouncement: (data) => api.post(`/chat/announcements`, data),

  listAnnouncements: () => api.get(`/chat/announcements`),

  markAnnouncementRead: (announcementId, acknowledged = false) =>
    api.post(`/chat/announcements/${announcementId}/read`, { acknowledged }),

  getUnreadCount: () => api.get(`/chat/unread-count`),
};

export default chatService;
