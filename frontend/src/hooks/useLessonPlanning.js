import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import lessonService from "../services/lessonService";

export const useLessonPlanning = (teacherId) => {
  const [lessonPlans, setLessonPlans] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch lessons for date range
  const fetchLessons = useCallback(
    async (dateFrom, dateTo, classId, status) => {
      setLoading(true);
      try {
        const response = await lessonService.getLessonPlans(
          teacherId,
          dateFrom,
          dateTo,
          classId,
          status
        );
        setLessonPlans(response.data?.lessons || []);
      } catch (error) {
        toast.error("Failed to load lessons");
        console.error("Error fetching lessons:", error);
      } finally {
        setLoading(false);
      }
    },
    [teacherId]
  );

  // Fetch calendar data
  const fetchCalendarData = useCallback(
    async (yearMonth) => {
      try {
        const response = await lessonService.getCalendarView(teacherId, yearMonth);
        return response.data?.dates || {};
      } catch (error) {
        toast.error("Failed to load calendar data");
        console.error("Error fetching calendar:", error);
        return {};
      }
    },
    [teacherId]
  );

  // Create new lesson plan
  const createLesson = useCallback(
    async (formData) => {
      setLoading(true);
      try {
        const response = await lessonService.createLessonPlan(formData);
        const newLesson = response.data;
        setLessonPlans((prev) => [...prev, newLesson]);
        toast.success("Lesson plan created successfully");
        return newLesson;
      } catch (error) {
        const errorMsg =
          error.response?.data?.detail ||
          error.message ||
          "Failed to create lesson";
        toast.error(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Update existing lesson
  const updateLesson = useCallback(async (lessonId, updates) => {
    setLoading(true);
    try {
      const response = await lessonService.updateLessonPlan(lessonId, updates);
      const updatedLesson = response.data;
      setLessonPlans((prev) =>
        prev.map((lp) => (lp.id === lessonId ? updatedLesson : lp))
      );
      toast.success("Lesson plan updated");
      return updatedLesson;
    } catch (error) {
      toast.error("Failed to update lesson");
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete lesson
  const deleteLesson = useCallback(async (lessonId) => {
    setLoading(true);
    try {
      await lessonService.deleteLessonPlan(lessonId);
      setLessonPlans((prev) => prev.filter((lp) => lp.id !== lessonId));
      toast.success("Lesson plan deleted");
    } catch (error) {
      toast.error("Failed to delete lesson");
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark lesson complete
  const markComplete = useCallback(async (lessonId) => {
    try {
      const response = await lessonService.markLessonComplete(lessonId);
      const completedLesson = response.data;
      setLessonPlans((prev) =>
        prev.map((lp) => (lp.id === lessonId ? completedLesson : lp))
      );
      toast.success("Lesson marked as completed");
      return completedLesson;
    } catch (error) {
      toast.error("Failed to mark lesson complete");
      throw error;
    }
  }, []);

  // Get syllabus coverage
  const getSyllabusCoverage = useCallback(
    async (classId, librarySubjectId) => {
      try {
        const response = await lessonService.getSyllabusCoverage(
          teacherId,
          classId,
          librarySubjectId
        );
        return response.data;
      } catch (error) {
        toast.error("Failed to load syllabus coverage");
        console.error("Error fetching coverage:", error);
        return null;
      }
    },
    [teacherId]
  );

  return {
    lessonPlans,
    selectedLesson,
    setSelectedLesson,
    loading,
    currentMonth,
    setCurrentMonth,
    fetchLessons,
    fetchCalendarData,
    createLesson,
    updateLesson,
    deleteLesson,
    markComplete,
    getSyllabusCoverage,
  };
};
