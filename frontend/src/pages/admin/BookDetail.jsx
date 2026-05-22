import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import libraryService from "../../services/libraryService";
import teacherService from "../../services/teacherService";
import { PageSpinner } from "../../components/common/Spinner";
import { CreateTopicModal } from "../../components/slides/CreateTopicModal";
import { CreateChapterModal } from "../../components/slides/CreateChapterModal";
import toast from "react-hot-toast";
import {
  BookOpenIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  SparklesIcon,
  PencilSquareIcon,
  TrashIcon,
  PlayIcon,
  ArrowPathIcon,
  FilmIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

export default function BookDetail() {
  const { bookId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [expandedChapters, setExpandedChapters] = useState({});
  const [deletingSlides, setDeletingSlides] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingLecture, setDeletingLecture] = useState(false);
  const [contentStatus, setContentStatus] = useState({});
  const [homeworkCounts, setHomeworkCounts] = useState({});
  const [createChapterModalOpen, setCreateChapterModalOpen] = useState(false);
  const [createTopicModalOpen, setCreateTopicModalOpen] = useState(false);
  const [selectedChapterForTopic, setSelectedChapterForTopic] = useState(null);
  const [boards, setBoards] = useState([]);

  // passed via navigate state for breadcrumb
  const boardId = location.state?.boardId;
  const boardName = location.state?.boardName;
  const subjectName = location.state?.subjectName;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookRes, statusRes, homeworkRes] = await Promise.all([
        libraryService.getBookDetails(bookId),
        teacherService.getMyContentStatusForBook(bookId).catch(() => ({ data: {} })),
        teacherService.getHomeworkCounts(bookId).catch(() => ({ data: { data: [] } })),
      ]);
      const data = bookRes?.data?.data ?? bookRes?.data;
      setBook(data);
      setContentStatus(statusRes?.data ?? {});

      // Build homework count map: { topic_id: count, chapter_id: count }
      const counts = {};
      (homeworkRes?.data?.data || []).forEach(item => {
        if (item.topic_id) counts[`topic_${item.topic_id}`] = item.count;
        if (item.chapter_id) {
          counts[`chapter_${item.chapter_id}`] = (counts[`chapter_${item.chapter_id}`] || 0) + item.count;
        }
      });
      setHomeworkCounts(counts);

      if (data?.chapters?.length > 0) {
        setExpandedChapters({ [data.chapters[0].id]: true });
      }
    } catch {
      toast.error("Failed to load book.");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => { load(); }, [load]);

  // Load boards for modals
  useEffect(() => {
    (async () => {
      try {
        const res = await libraryService.getBoards();
        const list = res.data?.data ?? res.data ?? [];
        setBoards(Array.isArray(list) ? list : []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleChapterCreated = () => {
    load();
  };

  const handleTopicCreated = () => {
    load();
  };

  const toggleChapter = (chapterId) =>
    setExpandedChapters((p) => ({ ...p, [chapterId]: !p[chapterId] }));

  const selectTopic = (topic, chapter) => {
    setSelectedTopic(topic);
    setSelectedChapter(chapter);
    setConfirmDelete(false);
  };

  const handleDeleteSlides = async () => {
    if (!selectedTopic) return;
    setDeletingSlides(true);
    try {
      await teacherService.deleteMyTopicSlides(selectedTopic.id);
      toast.success("Your slides deleted.");
      setContentStatus((prev) => ({
        ...prev,
        [selectedTopic.id]: { ...prev[selectedTopic.id], has_slides: false },
      }));
      setConfirmDelete(false);
    } catch {
      toast.error("Failed to delete slides.");
    } finally {
      setDeletingSlides(false);
    }
  };

  const handleDeleteLecture = async () => {
    if (!selectedTopic?.id) return;
    if (!window.confirm("Delete your recorded lecture for this topic?")) return;
    setDeletingLecture(true);
    try {
      await teacherService.deleteMyTopicLecture(selectedTopic.id);
      toast.success("Recorded lecture deleted.");
      setContentStatus((prev) => ({
        ...prev,
        [selectedTopic.id]: { ...prev[selectedTopic.id], has_lecture: false },
      }));
    } catch {
      toast.error("Failed to delete lecture.");
    } finally {
      setDeletingLecture(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (!book) return (
    <div className="p-6 text-center text-gray-500">Book not found.</div>
  );

  const totalTopics = (book.chapters || []).reduce(
    (s, ch) => s + (ch.topics || []).length, 0
  );
  const myStatus = selectedTopic ? (contentStatus[selectedTopic.id] ?? {}) : {};
  const hasMySlides = Boolean(myStatus.has_slides);
  const hasMyLecture = Boolean(myStatus.has_lecture);

  return (
    <div className="p-6 max-w-7xl mx-auto pb-24">
      {/* Teacher info banner */}
      {user?.role === "teacher" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">📝 Your Personal Library:</span> Any chapters, topics, or content you add here are visible only to you. Shared library content remains unchanged for other teachers.
          </p>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6 flex-wrap">
        <Link to="/admin/library" className="hover:text-gray-700 transition-colors">Library</Link>
        {boardId && (
          <>
            <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <Link to={`/admin/library/boards/${boardId}`} state={{ board: { id: boardId, name: boardName } }} className="hover:text-gray-700 transition-colors">
              {boardName || "Board"}
            </Link>
          </>
        )}
        {subjectName && (
          <>
            <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{subjectName}</span>
          </>
        )}
        <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-semibold text-gray-900 truncate max-w-xs">{book.title}</span>
      </nav>

      {/* Book header */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-6 mb-6 border border-indigo-100">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <BookOpenIcon className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
            {book.author && <p className="text-sm text-gray-600 mt-1">By {book.author}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {book.board_name && (
                <span className="text-xs bg-white/70 text-indigo-700 px-2.5 py-1 rounded-full font-medium border border-indigo-100">
                  {book.board_name}
                </span>
              )}
              {book.edition_year && (
                <span className="text-xs bg-white/70 text-indigo-700 px-2.5 py-1 rounded-full font-medium border border-indigo-100">
                  {book.edition_year}
                </span>
              )}
              {(book.class_name || book.subject_name) && (
                <span className="text-xs bg-white/70 text-indigo-700 px-2.5 py-1 rounded-full font-medium border border-indigo-100">
                  {[book.class_name, book.subject_name].filter(Boolean).join(" · ")}
                </span>
              )}
              <span className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-full font-medium">
                {(book.chapters || []).length} chapters
              </span>
              <span className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-full font-medium">
                {totalTopics} topics
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout: chapters list + topic content */}
      <div className="flex gap-6">
        {/* Left: Chapters & Topics tree */}
        <div className="w-80 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Chapters</h2>
            <button
              onClick={() => setCreateChapterModalOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
              title="Add chapter"
            >
              <PlusIcon className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {(book.chapters || []).map((chapter) => (
              <div key={chapter.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Chapter row */}
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {expandedChapters[chapter.id] ? (
                    <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    Ch {chapter.chapter_number}
                  </span>
                  <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">
                    {chapter.title}
                  </span>
                  <div className="flex gap-2 flex-shrink-0 items-center">
                    {homeworkCounts[`chapter_${chapter.id}`] > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        📚 {homeworkCounts[`chapter_${chapter.id}`]}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {(chapter.topics || []).length}
                    </span>
                  </div>
                </button>

                {/* Topics list */}
                {expandedChapters[chapter.id] && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-500">Topics</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedChapterForTopic(chapter.id);
                          setCreateTopicModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                        title="Add topic"
                      >
                        <PlusIcon className="h-3 w-3" /> Add
                      </button>
                    </div>
                    {(chapter.topics || []).length === 0 ? (
                      <p className="text-xs text-gray-400 px-4 py-2">No topics</p>
                    ) : (
                      (chapter.topics || []).map((topic, idx) => (
                        <button
                          key={topic.id}
                          onClick={() => selectTopic(topic, chapter)}
                          className={`w-full text-left flex items-start gap-2 px-4 py-2 text-sm transition-colors ${
                            selectedTopic?.id === topic.id
                              ? "bg-indigo-50 text-indigo-700 font-medium"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <span className="text-xs text-gray-400 mt-0.5 w-5 flex-shrink-0">{idx + 1}.</span>
                          <span className="flex-1 min-w-0">
                            <span className="line-clamp-2 block">{topic.title}</span>
                            {(contentStatus[topic.id]?.has_slides || contentStatus[topic.id]?.has_lecture || homeworkCounts[`topic_${topic.id}`]) && (
                              <span className="flex gap-1 mt-1 flex-wrap">
                                {contentStatus[topic.id]?.has_slides && (
                                  <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Slides</span>
                                )}
                                {contentStatus[topic.id]?.has_lecture && (
                                  <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Lecture</span>
                                )}
                                {homeworkCounts[`topic_${topic.id}`] > 0 && (
                                  <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">📚 {homeworkCounts[`topic_${topic.id}`]}</span>
                                )}
                              </span>
                            )}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Topic content */}
        <div className="flex-1 min-w-0">
          {selectedTopic ? (
            <div>
              {/* Topic header */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 font-medium mb-1">
                      Chapter {selectedChapter?.chapter_number} · {selectedChapter?.title}
                    </p>
                    <h2 className="text-xl font-bold text-gray-900">{selectedTopic.title}</h2>
                  </div>
                </div>

                {/* Action buttons — behaviour depends on whether this user has personal slides */}
                <div className="flex gap-2 mt-4 flex-wrap items-center">
                  {hasMySlides ? (
                    <>
                      {/* Present */}
                      <button
                        onClick={() =>
                          navigate(`/admin/library/topics/${selectedTopic.id}/present`)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        <PlayIcon className="h-3.5 w-3.5" />
                        Present
                      </button>

                      {/* Edit slides */}
                      <button
                        onClick={() =>
                          navigate("/admin/slides", {
                            state: {
                              topic: selectedTopic,
                              libraryContext: { book, chapter: selectedChapter },
                            },
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-50 transition-colors"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                        Edit Slides
                      </button>

                      <button
                        onClick={() => {
                          const w = window.open(`/admin/record-lecture/${selectedTopic.id}`, "_blank");
                          if (!w) {
                            navigate(`/admin/record-lecture/${selectedTopic.id}`);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors"
                      >
                        <FilmIcon className="h-3.5 w-3.5" />
                        {hasMyLecture ? "Re-record Lecture" : "Record Lecture"}
                      </button>

                      {hasMyLecture && (
                        <>
                          <button
                            onClick={() => navigate(`/admin/topics/${selectedTopic.id}/lecture`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                          >
                            <PlayIcon className="h-3.5 w-3.5" />
                            Open Recorded Lecture
                          </button>
                          <button
                            onClick={handleDeleteLecture}
                            disabled={deletingLecture}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {deletingLecture ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <TrashIcon className="h-3.5 w-3.5" />}
                            Delete Lecture
                          </button>
                        </>
                      )}

                      {/* Delete slides (with confirm step) */}
                      {!confirmDelete ? (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          Delete Slides
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-red-600 font-medium">Delete slides?</span>
                          <button
                            onClick={handleDeleteSlides}
                            disabled={deletingSlides}
                            className="text-xs font-bold text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {deletingSlides ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin inline" /> : "Yes, delete"}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    /* No slides yet — create slides and add homework */
                    <>
                      <button
                        onClick={() =>
                          navigate("/teacher/slides", {
                            state: {
                              topic: selectedTopic,
                              libraryContext: { book, chapter: selectedChapter },
                            },
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        <SparklesIcon className="h-3.5 w-3.5" />
                        Create Slides
                      </button>
                      <button
                        onClick={() =>
                          navigate("/teacher/homework", {
                            state: {
                              topic: selectedTopic,
                              libraryContext: { book, chapter: selectedChapter },
                            },
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                      >
                        <DocumentTextIcon className="h-3.5 w-3.5" />
                        Add Homework
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Content body */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Content</h3>
                  <button
                    onClick={() =>
                      navigate("/teacher/slides", {
                        state: {
                          topic: selectedTopic,
                          libraryContext: { book, chapter: selectedChapter },
                        },
                      })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                    title="Create slides with AI"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Add Content
                  </button>
                </div>
                {selectedTopic.content_body ? (
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedTopic.content_body}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No content extracted for this topic.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-2xl border border-gray-200">
              <BookOpenIcon className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium text-gray-500">Select a topic from the left to read its content</p>
              <p className="text-xs text-gray-400 mt-1">Click any chapter to expand, then select a topic</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateChapterModal
        open={createChapterModalOpen}
        onClose={() => setCreateChapterModalOpen(false)}
        onChapterCreated={handleChapterCreated}
        boards={boards}
        user={user}
        teacherSpecific={user?.role === "teacher"}
      />

      <CreateTopicModal
        open={createTopicModalOpen}
        onClose={() => {
          setCreateTopicModalOpen(false);
          setSelectedChapterForTopic(null);
        }}
        onTopicCreated={handleTopicCreated}
        boards={boards}
        preselectedChapterId={selectedChapterForTopic}
        user={user}
        teacherSpecific={user?.role === "teacher"}
      />
    </div>
  );
}
