import { useState, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import lessonService from "../../services/lessonService";

export function LessonCalendar({ teacherId, onDateSelect, onDayClick, selectedDate }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCalendar();
  }, [currentDate, teacherId]);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const yearMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM
      const response = await lessonService.getCalendarView(teacherId, yearMonth);
      setCalendarData(response.data?.dates || {});
    } catch (error) {
      console.error("Error loading calendar:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);
  const days = [];

  // Empty cells before month starts
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }

  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthName = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">{monthName}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={previousMonth}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Previous month"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Today
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Next month"
          >
            <ChevronRightIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-gray-600 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="py-20 text-center text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const dateStr = `${currentDate.getFullYear()}-${String(
              currentDate.getMonth() + 1
            ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

            const dayData = calendarData[dateStr];
            const hasLessons = dayData && dayData.lesson_count > 0;
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === new Date().toISOString().split("T")[0];

            return (
              <button
                key={day}
                onClick={() => onDayClick && onDayClick(dateStr)}
                className={`aspect-square rounded-lg border p-1 text-sm transition ${
                  isSelected
                    ? "bg-indigo-600 border-indigo-600 ring-2 ring-indigo-300"
                    : hasLessons
                    ? "bg-blue-50 border-blue-300 hover:bg-blue-100"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="h-full flex flex-col justify-between">
                  <span className={`font-semibold ${
                    isSelected ? "text-white" : isToday ? "text-indigo-600" : hasLessons ? "text-blue-900" : "text-gray-900"
                  }`}>
                    {day}
                  </span>
                  {hasLessons && (
                    <div className="text-xs space-y-0.5">
                      <div className={`rounded px-1 py-0.5 truncate ${isSelected ? "bg-white/30 text-white" : "bg-blue-500 text-white"}`}
                        title={`${dayData.lesson_count} lesson(s)`}>
                        {dayData.lesson_count} lesson{dayData.lesson_count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-blue-50 border border-blue-300" />
            <span>Day with lesson(s) planned</span>
          </div>
        </div>
      </div>
    </div>
  );
}
