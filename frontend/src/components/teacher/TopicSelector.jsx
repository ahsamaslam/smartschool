import { useState, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export function TopicSelector({
  bookId,
  onTopicsChange,
  assignedBooks = [],
  selectedTopics = [],
  loading = false,
}) {
  const [expandedChapters, setExpandedChapters] = useState({});
  const [chapters, setChapters] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Get selected book
  const selectedBook = assignedBooks.find((b) => b.id === bookId);

  // Get chapters from selected book
  useEffect(() => {
    if (selectedBook?.chapters) {
      setChapters(selectedBook.chapters);
    } else {
      setChapters([]);
    }
    setExpandedChapters({});
  }, [bookId, selectedBook]);

  const toggleChapter = (chapterId) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const toggleTopic = (topicId, topic) => {
    const isSelected = selectedTopics.some((t) => t.library_topic_id === topicId);

    if (isSelected) {
      onTopicsChange(selectedTopics.filter((t) => t.library_topic_id !== topicId));
    } else {
      onTopicsChange([
        ...selectedTopics,
        {
          library_topic_id: topicId,
          chapter_number: topic.chapter_number,
          topic_title: topic.title,
        },
      ]);
    }
  };

  const filteredChapters = chapters.filter((ch) => {
    if (!searchTerm) return true;
    return (
      ch.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ch.topics || []).some((t) =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  });

  if (!bookId) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center text-gray-500">
        Select a book first to choose topics
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Search chapters or topics..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
      />

      {/* Chapters & Topics */}
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg bg-white">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading topics...</div>
        ) : filteredChapters.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No chapters found</div>
        ) : (
          filteredChapters.map((chapter) => (
            <div key={chapter.id} className="border-b border-gray-100 last:border-b-0">
              {/* Chapter Header */}
              <button
                type="button"
                onClick={() => toggleChapter(chapter.id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-sm font-medium text-gray-900"
              >
                <ChevronDownIcon
                  className={`h-4 w-4 transform transition ${
                    expandedChapters[chapter.id] ? "rotate-0" : "-rotate-90"
                  }`}
                />
                <span>
                  Chapter {chapter.chapter_number}: {chapter.title}
                </span>
                <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  {(chapter.topics || []).length} topics
                </span>
              </button>

              {/* Topics */}
              {expandedChapters[chapter.id] && (
                <div className="bg-gray-50 px-3 py-2 space-y-2">
                  {(chapter.topics || []).map((topic) => {
                    const isSelected = selectedTopics.some(
                      (t) => t.library_topic_id === topic.id
                    );
                    return (
                      <label
                        key={topic.id}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTopic(topic.id, topic)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-700">{topic.title}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Selected Topics Summary */}
      {selectedTopics.length > 0 && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
          <p className="text-xs font-semibold text-blue-900 mb-2">
            {selectedTopics.length} topic(s) selected
          </p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {selectedTopics.map((topic) => (
              <div
                key={topic.library_topic_id}
                className="text-xs text-blue-800 flex items-center justify-between gap-2 bg-white p-1.5 rounded"
              >
                <span>
                  Ch {topic.chapter_number}: {topic.topic_title}
                </span>
                <button
                  type="button"
                  onClick={() => toggleTopic(topic.library_topic_id, {})}
                  className="text-blue-600 hover:text-blue-900 font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
