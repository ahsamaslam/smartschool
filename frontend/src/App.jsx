import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { PageSpinner } from "./components/common/Spinner";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleBasedRedirect from "./routes/RoleBasedRoute";
import TeacherRoute from "./routes/TeacherRoute";
import { useAuth } from "./context/AuthContext";

// Auth pages (no lazy — small, always needed)
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import ForcePasswordChange from "./pages/auth/ForcePasswordChange";

// ── Lazy-loaded portals ──────────────────────────────────────────────────────
// Student
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const MyCourses = lazy(() => import("./pages/student/MyCourses"));
const StudentCourseSubject = lazy(
  () => import("./pages/student/StudentCourseSubject"),
);
const StudentCourseBook = lazy(
  () => import("./pages/student/StudentCourseBook"),
);
const StudentCourseChapter = lazy(
  () => import("./pages/student/StudentCourseChapter"),
);
const StudentTopicLearn = lazy(
  () => import("./pages/student/StudentTopicLearn"),
);
const StudentExams = lazy(() => import("./pages/student/StudentExams"));
const MyEnrollment = lazy(() => import("./pages/student/MyEnrollment"));
const SubjectView = lazy(() => import("./pages/student/SubjectView"));
const VideoLesson = lazy(() => import("./pages/student/VideoLesson"));
const QuizPage = lazy(() => import("./pages/student/QuizPage"));
const QuizResults = lazy(() => import("./pages/student/QuizResults"));
const StudentProfile = lazy(() => import("./pages/student/Profile"));
const StudentHomework = lazy(() => import("./pages/student/StudentHomework"));
const StudentHomeworkDetail = lazy(
  () => import("./pages/student/StudentHomeworkDetail"),
);

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
const TeacherClassHomework = lazy(
  () => import("./pages/teacher/TeacherClassHomework"),
);
const TeacherHomeworkEditor = lazy(
  () => import("./pages/teacher/TeacherHomeworkEditor"),
);
const TeacherHomeworkSubmissions = lazy(
  () => import("./pages/teacher/TeacherHomeworkSubmissions"),
);
const TeacherHomework = lazy(() => import("./pages/teacher/Homework"));
const TeacherMyCurriculum = lazy(() => import("./pages/teacher/MyCurriculum"));
const TeacherSlides = lazy(() => import("./pages/teacher/Slides"));
const TeacherMySlides = lazy(() => import("./pages/teacher/MySlides"));
const TeacherSlideViewer = lazy(() => import("./pages/teacher/SlideViewer"));
const TeacherRecordLecture = lazy(() => import("./pages/teacher/TeacherRecordLecture"));
const TeacherMyLectures = lazy(() => import("./pages/teacher/MyLectures"));
const TeacherDailyDashboard = lazy(() => import("./pages/teacher/DailyDashboard"));

// Manager
const ManagerDashboard = lazy(() => import("./pages/manager/Dashboard"));
const ManagerSchools = lazy(() => import("./pages/manager/Schools"));
const SchoolBranches = lazy(() => import("./pages/manager/SchoolBranches"));
const BranchView = lazy(() => import("./pages/manager/BranchDetail"));
const StudentReports = lazy(() => import("./pages/manager/StudentReports"));
const ClassReports = lazy(() => import("./pages/manager/ClassReports"));
const TeacherReportsMgr = lazy(() => import("./pages/manager/TeacherReports"));
const ManagerTeachers = lazy(() => import("./pages/manager/Teachers"));
const ManagerStudents = lazy(() => import("./pages/manager/Students"));
const ManagerSettings = lazy(() => import("./pages/manager/Settings"));
const SpiReport = lazy(() => import("./pages/manager/SpiReport"));

// Admin
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminTenants = lazy(() => import("./pages/admin/Tenants"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminSchools = lazy(() => import("./pages/admin/Schools"));
const AdminTeachers = lazy(() => import("./pages/admin/Teachers"));
const AdminStudents = lazy(() => import("./pages/admin/Students"));
const AdminStudentPreview = lazy(
  () => import("./pages/admin/AdminStudentPreview"),
);
const AdminCurriculum = lazy(() => import("./pages/admin/Curriculum"));
const AdminLibrary = lazy(() => import("./pages/admin/Library"));
const AdminAIParser = lazy(() => import("./pages/admin/AIParser"));
const AdminVideos = lazy(() => import("./pages/admin/Videos"));
const AdminSlides = lazy(() => import("./pages/admin/Slides"));
const AdminRecordLecture = lazy(() => import("./pages/admin/RecordLecture"));
const AdminRecordedLectures = lazy(
  () => import("./pages/admin/RecordedLectures"),
);
const AdminLibraryTopicPresent = lazy(
  () => import("./pages/admin/LibraryTopicPresent"),
);
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminClassDetail = lazy(() => import("./pages/admin/ClassDetail"));
const AdminBoardSubjects = lazy(() => import("./pages/admin/BoardSubjects"));
const AdminBookDetail = lazy(() => import("./pages/admin/BookDetail"));
const AdminSectionDetail = lazy(() => import("./pages/admin/SectionDetail"));
const AdminTeacherSectionsPreview = lazy(
  () => import("./pages/admin/AdminTeacherSectionsPreview"),
);

// Chat
const StudentChat = lazy(() => import("./pages/student/StudentChat"));
const TeacherChat = lazy(() => import("./pages/teacher/TeacherChat"));
const ManagerChat = lazy(() => import("./pages/manager/ManagerChat"));
const AdminChat = lazy(() => import("./pages/admin/AdminChat"));

// Shared
const ProfilePage = lazy(() => import("./pages/shared/ProfilePage"));
const TopicLecturePlayer = lazy(
  () => import("./pages/shared/TopicLecturePlayer"),
);

// Parent Portal
const StudentReport = lazy(() => import("./pages/parent/StudentReport"));

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const superAdminOnly = (element) =>
    isSuperAdmin ? element : <Navigate to="/admin/dashboard" replace />;

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
          <Route
            path="/auth/force-password-change"
            element={<ForcePasswordChange />}
          />

          <Route element={<Layout />}>
            {/* ── STUDENT ── */}
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route
              path="/student/courses/class/:classId/board/:boardId/subject/:subjectId/book/:bookId/chapter/:chapterId"
              element={<StudentCourseChapter />}
            />
            <Route
              path="/student/courses/class/:classId/board/:boardId/subject/:subjectId/book/:bookId"
              element={<StudentCourseBook />}
            />
            <Route
              path="/student/courses/class/:classId/board/:boardId/subject/:subjectId"
              element={<StudentCourseSubject />}
            />
            <Route path="/student/courses" element={<MyCourses />} />
            <Route path="/student/homework" element={<StudentHomework />} />
            <Route
              path="/student/homework/:homeworkId"
              element={<StudentHomeworkDetail />}
            />
            <Route path="/student/exams" element={<StudentExams />} />
            <Route path="/student/enrollment" element={<MyEnrollment />} />
            <Route
              path="/student/learn/topic/:topicId"
              element={<StudentTopicLearn />}
            />
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
            <Route path="/student/chat" element={<StudentChat />} />
            <Route path="/student/report/:studentId" element={<StudentReport />} />

            {/* ── TEACHER (students cannot open these URLs — see TeacherRoute) ── */}
            <Route element={<TeacherRoute />}>
              <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
              <Route path="/teacher/classes" element={<TeacherClasses />} />
              <Route path="/teacher/homework" element={<TeacherHomework />} />
              <Route
                path="/teacher/classes/:classId"
                element={<ClassDetail />}
              />
              <Route
                path="/teacher/classes/:classId/homework"
                element={<TeacherClassHomework />}
              />
              <Route
                path="/teacher/classes/:classId/homework/new"
                element={<TeacherHomeworkEditor />}
              />
              <Route
                path="/teacher/classes/:classId/homework/:homeworkId/edit"
                element={<TeacherHomeworkEditor />}
              />
              <Route
                path="/teacher/classes/:classId/homework/:homeworkId/submissions"
                element={<TeacherHomeworkSubmissions />}
              />
              <Route
                path="/teacher/classes/:classId/student/:studentId"
                element={<StudentDetail />}
              />
              <Route
                path="/teacher/attendance"
                element={<TeacherAttendance />}
              />
              <Route path="/teacher/publish-video" element={<PublishVideo />} />
              <Route path="/teacher/avatar-videos" element={<AvatarVideos />} />
              <Route
                path="/teacher/lecture-viewer"
                element={<LectureViewer />}
              />
              <Route path="/teacher/generate-exam" element={<GenerateExam />} />
              <Route path="/teacher/exams" element={<ExamsPage />} />
              <Route path="/teacher/exams/:examId" element={<ExamEditor />} />
              <Route path="/teacher/reports" element={<TeacherReports />} />
              <Route path="/teacher/daily-dashboard/:classId" element={<TeacherDailyDashboard />} />
              <Route
                path="/teacher/curriculum"
                element={<TeacherMyCurriculum />}
              />
              <Route path="/teacher/chat" element={<TeacherChat />} />
              <Route path="/teacher/my-slides" element={<TeacherMySlides />} />
              <Route path="/teacher/slides" element={<TeacherSlides />} />
              <Route path="/teacher/slide-viewer" element={<TeacherSlideViewer />} />
              <Route path="/teacher/record-lecture/:libraryTopicId" element={<TeacherRecordLecture />} />
              <Route path="/teacher/my-lectures" element={<TeacherMyLectures />} />
            </Route>

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
            <Route path="/manager/library" element={<AdminLibrary />} />
            <Route
              path="/manager/library/boards/:boardId"
              element={<AdminBoardSubjects />}
            />
            <Route
              path="/manager/library/books/:bookId"
              element={<AdminBookDetail />}
            />
            <Route
              path="/manager/library/topics/:topicId/present"
              element={<AdminLibraryTopicPresent />}
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
            <Route path="/manager/spi-report" element={<SpiReport />} />
            <Route path="/manager/teachers" element={<ManagerTeachers />} />
            <Route path="/manager/students" element={<ManagerStudents />} />
            <Route path="/manager/settings" element={<ManagerSettings />} />
            <Route path="/manager/chat" element={<ManagerChat />} />

            {/* ── ADMIN ── */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route
              path="/admin/tenants"
              element={superAdminOnly(<AdminTenants />)}
            />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/schools" element={<AdminSchools />} />
            <Route
              path="/admin/classes/:classId"
              element={<AdminClassDetail />}
            />
            <Route
              path="/admin/schools/:schoolId/branches/:branchId"
              element={<BranchView />}
            />
            <Route
              path="/admin/schools/:schoolId"
              element={<SchoolBranches />}
            />
            <Route path="/admin/teachers" element={<AdminTeachers />} />
            <Route
              path="/admin/teachers/:teacherId/sections"
              element={<AdminTeacherSectionsPreview />}
            />
            <Route
              path="/admin/students/:studentId/view"
              element={<AdminStudentPreview />}
            />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/curriculum" element={<AdminCurriculum />} />
            <Route path="/admin/library" element={<AdminLibrary />} />
            <Route
              path="/admin/library/boards/:boardId"
              element={<AdminBoardSubjects />}
            />
            <Route
              path="/admin/library/books/:bookId"
              element={<AdminBookDetail />}
            />
            <Route
              path="/admin/sections/:sectionId"
              element={<AdminSectionDetail />}
            />
            <Route
              path="/admin/ai-parser"
              element={superAdminOnly(<AdminAIParser />)}
            />
            <Route path="/admin/videos" element={<AdminVideos />} />
            <Route
              path="/admin/library/topics/:topicId/present"
              element={<AdminLibraryTopicPresent />}
            />
            <Route path="/admin/slides" element={<AdminSlides />} />
            <Route
              path="/admin/recorded-lectures"
              element={<AdminRecordedLectures />}
            />
            <Route
              path="/admin/record-lecture/:libraryTopicId?"
              element={<AdminRecordLecture />}
            />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/chat" element={<AdminChat />} />

            {/* Profile — shared across all roles */}
            <Route path="/student/profile" element={<ProfilePage />} />
            <Route
              path="/student/topics/:topicId/lecture"
              element={<TopicLecturePlayer />}
            />
            <Route path="/teacher/profile" element={<ProfilePage />} />
            <Route path="/manager/profile" element={<ProfilePage />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
            <Route
              path="/admin/topics/:topicId/lecture"
              element={<TopicLecturePlayer />}
            />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
