import api from "../api";

const homeworkService = {
  studentList: () => api.get(`homework/student/list`),

  studentGet: (homeworkId) => api.get(`homework/student/${homeworkId}`),

  submitInteractive: (homeworkId, answers) =>
    api.post(`homework/student/${homeworkId}/submit-interactive`, { answers }),

  saveProgress: (homeworkId, answers) =>
    api.post(`homework/student/${homeworkId}/save-progress`, { answers }),

  submitUpload: (homeworkId, fileAssets) => {
    const form = new FormData();
    for (const asset of fileAssets) {
      form.append("files", {
        uri: asset.uri,
        name: asset.name ?? "upload",
        type: asset.mimeType ?? "application/octet-stream",
      });
    }
    return api.post(`homework/student/${homeworkId}/submit-upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export default homeworkService;
