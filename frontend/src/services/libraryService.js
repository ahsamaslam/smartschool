import api from "./api";
import { normalizeLibraryTopicId } from "../utils/libraryNavigation";

const libraryService = {
  // ==================== LIBRARY CLASSES ====================
  getLibraryClasses: () => api.get("/library/classes"),
  createLibraryClass: (data) => api.post("/library/classes", data),
  deleteLibraryClass: (classId) => api.delete(`/library/classes/${classId}`),

  // ==================== SUBJECTS ====================
  getAllSubjects: () => api.get("/library/subjects"),
  
  createSubject: (data) => api.post("/library/subjects", data),
  
  getSubject: (subjectId) => api.get(`/library/subjects/${subjectId}`),
  
  deleteSubject: (subjectId) => api.delete(`/library/subjects/${subjectId}`),

  // ==================== CLASS-SUBJECT LINKING ====================
  getClassSubjects: (classId) =>
    api.get(`/library/classes/${classId}/subjects`),
  
  addSubjectToClass: (classId, data) =>
    api.post(`/library/classes/${classId}/subjects`, data),
  removeSubjectFromClass: (classId, subjectId) =>
    api.delete(`/library/classes/${classId}/subjects/${subjectId}`),

  // ==================== BOARDS ====================
  getBoards: () => api.get("/library/boards"),
  createBoard: (data) => api.post("/library/boards", data),
  deleteBoard: (boardId) => api.delete(`/library/boards/${boardId}`),
  getBoardSubjects: (boardId) => api.get(`/library/boards/${boardId}/subjects`),
  getBoardSubjectBooks: (boardId, subjectId) =>
    api.get(`/library/boards/${boardId}/subjects/${subjectId}/books`),
  setBoardSubjects: (boardId, data) =>
    api.put(`/library/boards/${boardId}/subjects`, data),

  // ==================== SECTION SUBJECT LINKING ====================
  getSectionSubjectCatalog: (classId) =>
    api.get(`/library/sections/${classId}/subjects/catalog`),
  setSectionSubjects: (classId, data) =>
    api.put(`/library/sections/${classId}/subjects`, data),
  getSectionCurriculum: (classId) =>
    api.get(`/library/sections/${classId}/curriculum`),
  setSectionBooks: (classId, data) =>
    api.put(`/library/sections/${classId}/books`, data),
  bulkAssignSections: (data) =>
    api.post(`/library/sections/bulk-assign`, data),

  // ==================== PDF UPLOAD ====================
  uploadBookPdf: (formData) => api.post("/library/upload-pdf", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }),

  // ==================== BOOKS ====================
  getBooks: (classId, subjectId) =>
    api.get(`/library/library/${classId}/${subjectId}/books`),
  
  createBook: (data) => api.post("/library/library/books", data),
  
  getBookDetails: (bookId) => api.get(`/library/library/books/${bookId}`),
  
  deleteBook: (bookId) => api.delete(`/library/library/books/${bookId}`),

  // ==================== AI PARSER ====================
  saveParsedBook: (data) => api.post("/library/library/parse-and-save", data),

  // ==================== CHAPTERS & TOPICS ====================
  getChapterTopics: (chapterId) =>
    api.get(`/library/library/chapters/${chapterId}/topics`),
  
  getTopic: (topicId, axiosConfig = {}) => {
    const id = normalizeLibraryTopicId(topicId);
    if (!id) {
      return Promise.reject(new Error("Missing topic id"));
    }
    return api.get(`library/library/topics/${id}`, axiosConfig);
  },

  listRecordedLectures: (params = {}) =>
    api.get("library/library/recorded-lectures", { params }),
  
  updateTopic: (topicId, data) =>
    api.put(`/library/library/topics/${topicId}`, data),

  uploadTopicLecture: (topicId, formData) =>
    api.post(`library/library/topics/${topicId}/lecture`, formData),

  deleteTopicLecture: (topicId) =>
    api.delete(`/library/library/topics/${topicId}/lecture`),

  createChapterTopic: (chapterId, data) =>
    api.post(`/library/library/chapters/${chapterId}/topics`, data),

  deleteTopic: (topicId) => api.delete(`/library/library/topics/${topicId}`),

  getLibraryStats: () => api.get("/library/stats"),
};

export default libraryService;
