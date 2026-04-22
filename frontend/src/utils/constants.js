// API route prefixes
export const API_ROUTES = {
  AUTH: "/auth",
  STUDENTS: "/students",
  TEACHERS: "/teachers",
  MANAGERS: "/managers",
  ADMINS: "/admins",
  VIDEOS: "/videos",
  QUIZZES: "/quizzes",
  QA: "/qa",
  ANALYTICS: "/analytics",
  ATTENDANCE: "/attendance",
  CLASSES: "/classes",
};

// User roles
export const ROLES = {
  STUDENT: "student",
  TEACHER: "teacher",
  MANAGER: "manager",
  ADMIN: "admin",
};

// Quiz configuration
export const QUIZ_CONFIG = {
  MAX_ATTEMPTS: 5,
  DEFAULT_DURATION: 30, // minutes
  MIN_PASS_SCORE: 50, // percent
  QUESTION_TYPES: [
    { value: "mcq", label: "MCQ" },
    { value: "short_answer", label: "Short Answer" },
    { value: "long_answer", label: "Long Answer" },
  ],
  COMPLEXITY: {
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "hard",
  },
};

// Report periods
export const REPORT_PERIODS = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Yearly", value: "yearly" },
  { label: "From Beginning", value: "all" },
];

// Score thresholds (for colour coding)
export const SCORE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  AVERAGE: 40,
};
