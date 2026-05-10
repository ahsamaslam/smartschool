/**
 * When an admin previews a teacher's sections, we remember which teacher so
 * Teacher → My Classes (/teacher/classes) can show the same class cards.
 */
const ID_KEY = "smart_school_admin_preview_teacher_id";
const NAME_KEY = "smart_school_admin_preview_teacher_name";

export function setAdminPreviewTeacher(teacherId, teacherName = "") {
  if (teacherId) sessionStorage.setItem(ID_KEY, String(teacherId));
  if (teacherName) sessionStorage.setItem(NAME_KEY, teacherName);
}

export function getAdminPreviewTeacherId() {
  return sessionStorage.getItem(ID_KEY);
}

export function getAdminPreviewTeacherName() {
  return sessionStorage.getItem(NAME_KEY) || "";
}

export function clearAdminPreviewTeacher() {
  sessionStorage.removeItem(ID_KEY);
  sessionStorage.removeItem(NAME_KEY);
}
