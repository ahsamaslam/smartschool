import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { PageSpinner } from "./components/common/Spinner";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleBasedRedirect from "./routes/RoleBasedRoute";

// Auth pages (no lazy — small, always needed)
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// ── Lazy-loaded portals ──────────────────────────────────────────────────────
// Student
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const SubjectView = lazy(() => import("./pages/student/SubjectView"));
const VideoLesson = lazy(() => import("./pages/student/VideoLesson"));
const QuizPage = lazy(() => import("./pages/student/QuizPage"));
const QuizResults = lazy(() => import("./pages/student/QuizResults"));
const StudentProfile = lazy(() => import("./pages/student/Profile"));

// Teacher
const TeacherDashboard = lazy(() => import("./pages/teacher/Dashboard"));
const TeacherClasses = lazy(() => import("./pages/teacher/Classes"));
const ClassDetail = lazy(() => import("./pages/teacher/ClassDetail"));
const StudentDetail = lazy(() => import("./pages/teacher/StudentDetail"));
const TeacherAttendance = lazy(() => import("./pages/teacher/Attendance"));
const PublishVideo = lazy(() => import("./pages/teacher/PublishVideo"));
const AvatarVideos = lazy(() => import("./pages/teacher/AvatarVideos"));
const LectureViewer = lazy(() => import("./pages/teacher/LectureViewerPage"));
const GenerateExam = lazy(() => import("./pages/teacher/GenerateExam"));
const ExamsPage = lazy(() => import("./pages/teacher/Exams"));
const ExamEditor = lazy(() => import("./pages/teacher/ExamEditor"));
const TeacherReports = lazy(() => import("./pages/teacher/Reports"));

// Manager
const ManagerDashboard = lazy(() => import("./pages/manager/Dashboard"));
const ManagerSchools = lazy(() => import("./pages/manager/Schools"));
const SchoolBranches = lazy(() => import("./pages/manager/SchoolBranches"));
const BranchView = lazy(() => import("./pages/manager/BranchDetail"));
const StudentReports = lazy(() => import("./pages/manager/StudentReports"));
const ClassReports = lazy(() => import("./pages/manager/ClassReports"));
const TeacherReportsMgr = lazy(() => import("./pages/manager/TeacherReports"));

// Admin
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminSchools = lazy(() => import("./pages/admin/Schools"));
const AdminTeachers = lazy(() => import("./pages/admin/Teachers"));
const AdminStudents = lazy(() => import("./pages/admin/Students"));
const AdminCurriculum = lazy(() => import("./pages/admin/Curriculum"));
const AdminLibrary = lazy(() => import("./pages/admin/Library"));
const AdminAIParser = lazy(() => import("./pages/admin/AIParser"));
const AdminVideos = lazy(() => import("./pages/admin/Videos"));
const AdminSlides = lazy(() => import("./pages/admin/Slides"));
const AdminRecordLecture = lazy(() => import("./pages/admin/RecordLecture"));
const AdminLibraryTopicPresent = lazy(
  () => import("./pages/admin/LibraryTopicPresent"),
);
const AdminSettings = lazy(() => import("./pages/admin/Settings"));

// Shared
const ProfilePage = lazy(() => import("./pages/shared/ProfilePage"));

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* After login — redirect to role dashboard */}
        <Route path="/" element={<RoleBasedRedirect />} />

        {/* Protected routes — all share the Layout shell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            {/* ── STUDENT ── */}
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route
              path="/student/subject/:subjectId"
              element={<SubjectView />}
            />
            <Route path="/student/video/:videoId" element={<VideoLesson />} />
            <Route path="/student/quiz/:instanceId" element={<QuizPage />} />
            <Route
              path="/student/quiz/:attemptId/results"
              element={<QuizResults />}
            />
            {/* /student/profile handled by shared ProfilePage below */}

            {/* ── TEACHER ── */}
            <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
            <Route path="/teacher/classes" element={<TeacherClasses />} />
            <Route path="/teacher/classes/:classId" element={<ClassDetail />} />
            <Route
              path="/teacher/classes/:classId/student/:studentId"
              element={<StudentDetail />}
            />
            <Route path="/teacher/attendance" element={<TeacherAttendance />} />
            <Route path="/teacher/publish-video" element={<PublishVideo />} />
            <Route path="/teacher/avatar-videos" element={<AvatarVideos />} />
            <Route path="/teacher/lecture-viewer" element={<LectureViewer />} />
            <Route path="/teacher/generate-exam" element={<GenerateExam />} />
            <Route path="/teacher/exams" element={<ExamsPage />} />
            <Route path="/teacher/exams/:examId" element={<ExamEditor />} />
            <Route path="/teacher/reports" element={<TeacherReports />} />

            {/* ── MANAGER ── */}
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/manager/schools" element={<ManagerSchools />} />
            <Route
              path="/manager/schools/:schoolId"
              element={<SchoolBranches />}
            />
            <Route
              path="/manager/schools/:schoolId/branches/:branchId"
              element={<BranchView />}
            />
            <Route
              path="/manager/student-reports"
              element={<StudentReports />}
            />
            <Route path="/manager/class-reports" element={<ClassReports />} />
            <Route
              path="/manager/teacher-reports"
              element={<TeacherReportsMgr />}
            />

            {/* ── ADMIN ── */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/schools" element={<AdminSchools />} />
            <Route
              path="/admin/schools/:schoolId/branches/:branchId"
              element={<BranchView />}
            />
            <Route
              path="/admin/schools/:schoolId"
              element={<SchoolBranches />}
            />
            <Route path="/admin/teachers" element={<AdminTeachers />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/curriculum" element={<AdminCurriculum />} />
            <Route path="/admin/library" element={<AdminLibrary />} />
            <Route path="/admin/ai-parser" element={<AdminAIParser />} />
            <Route path="/admin/videos" element={<AdminVideos />} />
            <Route
              path="/admin/library/topics/:topicId/present"
              element={<AdminLibraryTopicPresent />}
            />
            <Route path="/admin/slides" element={<AdminSlides />} />
            <Route
              path="/admin/record-lecture/:libraryTopicId?"
              element={<AdminRecordLecture />}
            />
            <Route path="/admin/settings" element={<AdminSettings />} />

            {/* Profile — shared across all roles */}
            <Route path="/student/profile" element={<ProfilePage />} />
            <Route path="/teacher/profile" element={<ProfilePage />} />
            <Route path="/manager/profile" element={<ProfilePage />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
