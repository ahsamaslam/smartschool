import { useEffect, useState, useCallback, useRef } from "react";
import adminService from "../../services/adminService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import Dropdown from "../../components/common/Dropdown";
import toast from "react-hot-toast";
import SlidePresenter, { pickTheme } from "../../components/admin/SlidePresenter";
import {
  BookOpenIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  VideoCameraIcon,
  PresentationChartBarIcon,
  TrashIcon,
  PencilSquareIcon,
  BuildingOffice2Icon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

// ─── Topic Studio Modal ───────────────────────────────────────────────────────

function TopicStudio({ topic, onClose, onUpdated }) {
  const [tab, setTab] = useState(topic?._tab || "content");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [slides, setSlides] = useState(null);
  const [slideTheme, setSlideTheme] = useState(null);
  const [loadingSlides, setLoadingSlides] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [mixing, setMixing] = useState(false);
  const [mixedUrl, setMixedUrl] = useState(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (!topic?.id) return;
    setTab(topic._tab || "content");
    setContent(topic.description || topic.content || "");
    setTitle(topic.title || "");
    setSlides(null);
    setLoadingSlides(true);
    adminService
      .getTopicSlides(topic.id)
      .then((res) => {
        if (res.data?.slides?.length) {
          setSlides(res.data.slides);
          setSlideTheme(res.data.theme || pickTheme(topic.title));
        } else {
          setSlides(null);
          setSlideTheme(pickTheme(topic.title));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSlides(false));
  }, [topic]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => () => stopStream(), []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      toast.error("Camera / microphone access denied.");
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const mr = new MediaRecorder(streamRef.current, { mimeType });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
    };
    mr.start(250);
    mediaRecorderRef.current = mr;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    stopStream();
  };

  const handleMix = async () => {
    if (!recordedBlob || !topic?.id) return;
    setMixing(true);
    try {
      const fd = new FormData();
      fd.append("template_id", topic.id);
      fd.append("teacher_video", recordedBlob, "teacher.webm");
      const res = await adminService.compositeTeacherPip(fd);
      setMixedUrl(res.data?.final_video_url);
      toast.success("Video composited successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Mixing failed.");
    } finally {
      setMixing(false);
    }
  };

  const handleGenerateContent = async () => {
    setGenerating(true);
    const tid = toast.loading("Claude AI is writing lesson content… (~30 sec)");
    try {
      const res = await adminService.generateTopicContent(topic.id);
      const newContent = res.data?.content || "";
      setContent(newContent);
      toast.success("Content generated! Review and save.", { id: tid });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Generation failed.", { id: tid });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveContent = async () => {
    setSaving(true);
    try {
      await adminService.updateTopic(topic.id, { title, description: content, content });
      toast.success("Content saved!");
      onUpdated?.({ ...topic, title, description: content, content });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSlides = async (newSlides, newTheme) => {
    await adminService.saveTopicSlides(topic.id, { slides: newSlides, theme: newTheme });
    setSlides(newSlides);
    setSlideTheme(newTheme);
    toast.success("Slides saved!");
  };

  const subject = topic?.subject_name || "";
  const chapter = topic?.chapter_name || "";

  if (!topic) return null;

  return (
    <Modal
      isOpen={!!topic}
      onClose={() => {
        stopStream();
        onClose();
      }}
      title={title || "Topic Studio"}
      wide
    >
      <div className="space-y-4">
        {/* Tab bar */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
          {[
            { key: "content", label: "Content", icon: PencilSquareIcon },
            { key: "slides", label: "Slides", icon: PresentationChartBarIcon },
            { key: "record", label: "Record & Mix", icon: VideoCameraIcon },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                if (key !== "record") stopStream();
                if (key === "record") startCamera();
                setTab(key);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:bg-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── CONTENT TAB ── */}
        {tab === "content" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Topic Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Topic Content
                </label>
                <button
                  type="button"
                  onClick={handleGenerateContent}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 transition-all shadow-sm"
                >
                  {generating ? (
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SparklesIcon className="h-3.5 w-3.5" />
                  )}
                  {generating ? "Generating…" : "Generate with AI"}
                </button>
              </div>
              {!content && !generating && (
                <div className="mb-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
                  <strong>No content yet.</strong> Click <em>Generate with AI</em> to have Claude write a
                  full lesson, or type your own below.
                </div>
              )}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y font-mono leading-relaxed"
                placeholder="Write the lesson content here, or click Generate with AI above…"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Sections like HOOK:, CORE CONCEPT:, SUMMARY: produce better slides.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setTab("slides")}
                disabled={generating}
              >
                Create Slides →
              </Button>
              <Button
                variant="primary"
                fullWidth
                loading={saving}
                disabled={generating}
                onClick={handleSaveContent}
              >
                Save Content
              </Button>
            </div>
          </div>
        )}

        {/* ── SLIDES TAB ── */}
        {tab === "slides" && (
          <div>
            {loadingSlides ? (
              <div className="flex items-center justify-center py-16">
                <ArrowPathIcon className="h-6 w-6 text-gray-400 animate-spin" />
              </div>
            ) : (
              <SlidePresenter
                slides={slides}
                theme={slideTheme || pickTheme(title)}
                onSave={handleSaveSlides}
                topicTitle={title}
                topicContent={content}
                subject={subject}
                chapter={chapter}
              />
            )}
          </div>
        )}

        {/* ── RECORD & MIX TAB ── */}
        {tab === "record" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              {["Content", "Slides", "Record", "Mix", "Done"].map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                      (i === 0 && content) ||
                      (i === 1 && slides?.length) ||
                      (i === 2 && recordedBlob) ||
                      (i === 3 && mixing) ||
                      (i === 4 && mixedUrl)
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {s}
                  {i < 4 && <span className="text-gray-200">›</span>}
                </span>
              ))}
            </div>

            {!slides?.length && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                ⚠️ Create and save slides first, then come back to record yourself presenting.
              </div>
            )}

            <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video">
              {!recordedUrl ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={recordedUrl}
                  controls
                  className="w-full h-full object-cover"
                />
              )}
              {recording && (
                <span className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                  ● REC
                </span>
              )}
              {!recordedUrl && !recording && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white/50">
                    <VideoCameraIcon className="h-12 w-12 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Camera will appear here</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {!recording && !recordedBlob && (
                <Button variant="primary" fullWidth onClick={startRecording}>
                  <span className="mr-1.5 text-red-300">●</span> Start Recording
                </Button>
              )}
              {recording && (
                <Button variant="danger" fullWidth onClick={stopRecording}>
                  ■ Stop Recording
                </Button>
              )}
              {recordedBlob && !mixing && !mixedUrl && (
                <>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      setRecordedBlob(null);
                      setRecordedUrl(null);
                      startCamera();
                    }}
                  >
                    Re-record
                  </Button>
                  <Button variant="primary" fullWidth onClick={handleMix}>
                    Mix with Slides →
                  </Button>
                </>
              )}
              {mixing && (
                <div className="flex-1 flex items-center justify-center gap-3 py-3 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-medium">
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Compositing video over slides…
                </div>
              )}
            </div>

            {!recordedBlob && !recording && (
              <div className="text-center">
                <label className="cursor-pointer text-xs text-indigo-600 hover:underline">
                  Or upload a pre-recorded video
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      stopStream();
                      setRecordedBlob(file);
                      setRecordedUrl(URL.createObjectURL(file));
                    }}
                  />
                </label>
              </div>
            )}

            {mixedUrl && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                  <CheckCircleIcon className="h-4 w-4" /> Mixed video ready!
                </p>
                <video
                  key={mixedUrl}
                  src={`http://localhost:8000/${mixedUrl.replace(/^\//, "")}`}
                  controls
                  className="w-full rounded-xl bg-black"
                  style={{ maxHeight: 300 }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, onOpen }) {
  return (
    <div className="group flex flex-col gap-2 bg-white rounded-xl border border-gray-100 px-3 py-2.5 hover:border-indigo-200 hover:shadow-sm transition-all">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-snug group-hover:text-indigo-700 transition-colors">
            {topic.title}
          </p>
          {topic.description && (
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
              {topic.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => onOpen({ ...topic, _tab: "content" })}
          className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          onClick={() => onOpen({ ...topic, _tab: "slides" })}
          className="flex-1 inline-flex items-center justify-center gap-1 text-xs px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <PresentationChartBarIcon className="h-3.5 w-3.5" /> Slides
        </button>
      </div>
    </div>
  );
}

// ─── Library Tab ──────────────────────────────────────────────────────────────

function LibraryTab({ subjects, schools, loading, onRefresh }) {
  const [expandedSchools, setExpandedSchools] = useState({});
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [topicsMap, setTopicsMap] = useState({});
  const [loadingTopics, setLoadingTopics] = useState({});
  const [search, setSearch] = useState("");
  const [studioTopic, setStudioTopic] = useState(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    description: "",
    grade_level: "",
  });
  const [topicForm, setTopicForm] = useState({
    subject_id: "",
    title: "",
    description: "",
    order_index: 1,
  });
  const [saving, setSaving] = useState(false);

  const loadTopics = async (subjectId) => {
    if (topicsMap[subjectId]) return;
    setLoadingTopics((p) => ({ ...p, [subjectId]: true }));
    try {
      const res = await adminService.getSubjectTopics(subjectId);
      setTopicsMap((p) => ({ ...p, [subjectId]: res.data || [] }));
    } catch {
      toast.error("Failed to load topics.");
    } finally {
      setLoadingTopics((p) => ({ ...p, [subjectId]: false }));
    }
  };

  const toggleSchool = (schoolId) => {
    setExpandedSchools((p) => ({ ...p, [schoolId]: !p[schoolId] }));
  };

  const toggleSubject = async (subjectId) => {
    const next = !expandedSubjects[subjectId];
    setExpandedSubjects((p) => ({ ...p, [subjectId]: next }));
    if (next) await loadTopics(subjectId);
  };

  const toggleChapter = (key) => {
    setExpandedChapters((p) => ({ ...p, [key]: !p[key] }));
  };

  const groupByChapter = (topics) => {
    const map = {};
    for (const t of topics) {
      const key = t.chapter_name || "General";
      if (!map[key]) map[key] = { number: t.chapter_number || 0, name: key, topics: [] };
      map[key].topics.push(t);
    }
    return Object.values(map).sort((a, b) => a.number - b.number);
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminService.createSubject(subjectForm);
      toast.success("Subject created!");
      setShowSubjectModal(false);
      setSubjectForm({ name: "", description: "", grade_level: "" });
      onRefresh();
    } catch {
      toast.error("Failed to create subject.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminService.createTopic({
        ...topicForm,
        order_index: Number(topicForm.order_index),
      });
      toast.success("Topic created!");
      setShowTopicModal(false);
      const sid = topicForm.subject_id;
      if (sid) {
        const res = await adminService.getSubjectTopics(sid);
        setTopicsMap((p) => ({ ...p, [sid]: res.data || [] }));
      }
    } catch {
      toast.error("Failed to create topic.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await adminService.deleteSubject(deleteConfirm.id);
      toast.success(`"${deleteConfirm.name}" deleted.`);
      setDeleteConfirm(null);
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const filteredSubjects = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.grade_level || "").toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <PageSpinner />;

  const schoolList =
    schools?.length > 0
      ? schools
      : [{ id: "_global", name: "Global Curriculum", address: "" }];

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search subjects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setShowTopicModal(true)}>
            + Topic
          </Button>
          <Button variant="primary" onClick={() => setShowSubjectModal(true)}>
            + Subject
          </Button>
        </div>
      </div>

      {/* Schools tree */}
      <div className="space-y-4">
        {schoolList.map((school) => {
          const isSchoolOpen = expandedSchools[school.id] !== false;

          return (
            <div
              key={school.id}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
            >
              {/* School header */}
              <button
                onClick={() => toggleSchool(school.id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                {isSchoolOpen ? (
                  <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
                <BuildingOffice2Icon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{school.name}</p>
                  {school.address && (
                    <p className="text-xs text-gray-400 truncate">{school.address}</p>
                  )}
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium">
                  {filteredSubjects.length} subjects
                </span>
              </button>

              {isSchoolOpen && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                  {filteredSubjects.length === 0 && (
                    <p className="text-sm text-gray-400 py-2 text-center">
                      {subjects.length === 0
                        ? "No subjects yet. Use AI Book Parser to get started."
                        : "No subjects match your search."}
                    </p>
                  )}

                  {filteredSubjects.map((subject) => {
                    const isSubjectOpen = !!expandedSubjects[subject.id];

                    return (
                      <div
                        key={subject.id}
                        className="rounded-xl border border-gray-100 overflow-hidden"
                      >
                        {/* Subject row */}
                        <div className="flex items-center">
                          <button
                            onClick={() => toggleSubject(subject.id)}
                            className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 transition-colors text-left"
                          >
                            {isSubjectOpen ? (
                              <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            )}
                            <AcademicCapIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 text-sm">
                                {subject.name}
                              </p>
                              {subject.description && (
                                <p className="text-xs text-gray-400 truncate">
                                  {subject.description}
                                </p>
                              )}
                            </div>
                            {subject.grade_level && (
                              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0">
                                Grade {subject.grade_level}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({
                                id: subject.id,
                                name: subject.name,
                                topicCount: topicsMap[subject.id]?.length ?? "?",
                              });
                            }}
                            className="mr-3 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete subject"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Chapters + Topics */}
                        {isSubjectOpen && (
                          <div className="border-t border-gray-50 px-4 pb-3 pt-2 bg-gray-50/50">
                            {loadingTopics[subject.id] ? (
                              <p className="text-xs text-gray-400 py-2">
                                <ArrowPathIcon className="h-3.5 w-3.5 inline animate-spin mr-1" />
                                Loading…
                              </p>
                            ) : !topicsMap[subject.id]?.length ? (
                              <p className="text-xs text-gray-400 py-2">
                                No topics yet.
                              </p>
                            ) : (
                              <div className="space-y-2 mt-1">
                                {groupByChapter(topicsMap[subject.id]).map((ch) => {
                                  const chKey = `${subject.id}_${ch.name}`;
                                  const isChOpen =
                                    expandedChapters[chKey] !== false;

                                  return (
                                    <div
                                      key={ch.name}
                                      className="rounded-lg border border-gray-100 bg-white overflow-hidden"
                                    >
                                      {/* Chapter header */}
                                      <button
                                        onClick={() => toggleChapter(chKey)}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                                      >
                                        {isChOpen ? (
                                          <ChevronDownIcon className="h-3 w-3 text-gray-400" />
                                        ) : (
                                          <ChevronRightIcon className="h-3 w-3 text-gray-400" />
                                        )}
                                        <BookOpenIcon className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                                        <span className="text-xs font-semibold text-gray-600 flex-1">
                                          {ch.number > 0
                                            ? `Chapter ${ch.number}: `
                                            : ""}
                                          {ch.name}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                          {ch.topics.length} topic
                                          {ch.topics.length !== 1 ? "s" : ""}
                                        </span>
                                      </button>

                                      {/* Topics grid */}
                                      {isChOpen && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 px-3 pb-3">
                                          {ch.topics.map((t) => (
                                            <TopicCard
                                              key={t.id}
                                              topic={{
                                                ...t,
                                                subject_name: subject.name,
                                                chapter_name: ch.name,
                                              }}
                                              onOpen={(tp) =>
                                                setStudioTopic(tp)
                                              }
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Topic Studio */}
      {studioTopic && (
        <TopicStudio
          topic={studioTopic}
          onClose={() => setStudioTopic(null)}
          onUpdated={(updated) => {
            setTopicsMap((p) => {
              const sid = studioTopic?.subject_id;
              if (!sid || !p[sid]) return p;
              return {
                ...p,
                [sid]: p[sid].map((t) =>
                  t.id === updated.id ? { ...t, ...updated } : t,
                ),
              };
            });
          }}
        />
      )}

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => !deleting && setDeleteConfirm(null)}
        title="Delete Subject"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">This cannot be undone.</p>
              <p>
                Deleting <strong>"{deleteConfirm.name}"</strong> will permanently
                remove the subject and all its topics
                {deleteConfirm.topicCount !== "?"
                  ? ` (${deleteConfirm.topicCount} topics)`
                  : ""}
                .
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                fullWidth
                loading={deleting}
                onClick={handleDeleteSubject}
              >
                Delete Subject
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Subject modal */}
      <Modal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        title="Create Subject"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <Input
            label="Subject Name"
            value={subjectForm.name}
            onChange={(e) =>
              setSubjectForm((f) => ({ ...f, name: e.target.value }))
            }
            required
          />
          <Input
            label="Description"
            value={subjectForm.description}
            onChange={(e) =>
              setSubjectForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <Input
            label="Grade Level"
            value={subjectForm.grade_level}
            onChange={(e) =>
              setSubjectForm((f) => ({ ...f, grade_level: e.target.value }))
            }
            placeholder="e.g. Grade 10"
            required
          />
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Create Subject
          </Button>
        </form>
      </Modal>

      {/* Create Topic modal */}
      <Modal
        isOpen={showTopicModal}
        onClose={() => setShowTopicModal(false)}
        title="Create Topic"
      >
        <form onSubmit={handleCreateTopic} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <Dropdown
              options={subjects.map((s) => ({
                value: s.id,
                label: `${s.name} (Grade ${s.grade_level})`,
              }))}
              value={topicForm.subject_id}
              onChange={(v) =>
                setTopicForm((f) => ({ ...f, subject_id: v }))
              }
              placeholder="Select subject…"
            />
          </div>
          <Input
            label="Topic Title"
            value={topicForm.title}
            onChange={(e) =>
              setTopicForm((f) => ({ ...f, title: e.target.value }))
            }
            required
          />
          <Input
            label="Description"
            value={topicForm.description}
            onChange={(e) =>
              setTopicForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <Input
            label="Order"
            type="number"
            value={topicForm.order_index}
            onChange={(e) =>
              setTopicForm((f) => ({ ...f, order_index: e.target.value }))
            }
            min={1}
            required
          />
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Create Topic
          </Button>
        </form>
      </Modal>
    </div>
  );
}

// ─── Upload Step ──────────────────────────────────────────────────────────────

function UploadStep({ onParsed }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.match(/\.(pdf|txt|md)$/i)) {
      toast.error("Please upload a PDF or text file.");
      return;
    }
    setFile(f);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await adminService.parseCurriculumBook(fd);
      toast.success("Book parsed successfully!");
      onParsed(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to parse book.");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <SparklesIcon className="h-7 w-7 text-indigo-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">AI Curriculum Parser</h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload a curriculum book and Claude AI will extract every subject,
          chapter, and topic automatically.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-indigo-500" />
            <div className="text-left">
              <p className="font-semibold text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        ) : (
          <>
            <CloudArrowUpIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">
              Drop your curriculum book here
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, TXT, or Markdown — up to 100 MB
            </p>
          </>
        )}
      </div>

      {file && (
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" onClick={() => setFile(null)} fullWidth>
            Remove
          </Button>
          <Button
            variant="primary"
            onClick={handleParse}
            loading={parsing}
            fullWidth
          >
            {parsing ? "Parsing with AI…" : "Parse Book"}
          </Button>
        </div>
      )}

      {parsing && (
        <div className="mt-4 p-4 bg-indigo-50 rounded-xl text-sm text-indigo-700">
          <ArrowPathIcon className="h-4 w-4 inline mr-2 animate-spin" />
          Claude AI is reading and structuring your curriculum. This may take up
          to 60 seconds…
        </div>
      )}
    </div>
  );
}

// ─── Review Step ──────────────────────────────────────────────────────────────

function ReviewStep({ parsed, onSave, onBack }) {
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});

  const totalTopics = (parsed.subjects || []).reduce(
    (acc, s) =>
      acc + s.chapters.reduce((a, c) => a + c.topics.length, 0),
    0,
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminService.saveParsedCurriculum(parsed);
      toast.success(
        `Saved: ${res.data.created.subjects} subjects, ${res.data.created.topics} topics`,
      );
      onSave();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save curriculum.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="bg-indigo-50 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <SparklesIcon className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-gray-900 text-lg">
              {parsed.book_title || "Curriculum Book"}
            </p>
            <p className="text-sm text-indigo-700 mt-0.5">
              Grade: <strong>{parsed.grade_level}</strong> ·{" "}
              {(parsed.subjects || []).length} subjects · {totalTopics} topics
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6 max-h-[50vh] overflow-y-auto pr-1">
        {(parsed.subjects || []).map((subject, si) => (
          <div
            key={si}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
          >
            <button
              onClick={() =>
                setExpanded((p) => ({ ...p, [si]: !p[si] }))
              }
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 text-left"
            >
              {expanded[si] ? (
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-gray-400" />
              )}
              <BookOpenIcon className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-900 flex-1">
                {subject.name}
              </span>
              <span className="text-xs text-gray-400">
                {subject.chapters.reduce(
                  (a, c) => a + c.topics.length,
                  0,
                )}{" "}
                topics
              </span>
            </button>
            {expanded[si] && (
              <div className="border-t border-gray-100 px-5 pb-4 pt-3 space-y-3">
                {subject.chapters.map((ch, ci) => (
                  <div key={ci}>
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">
                      Chapter {ch.number}: {ch.name}
                    </p>
                    <div className="space-y-1.5">
                      {ch.topics.map((t, ti) => (
                        <div
                          key={ti}
                          className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2"
                        >
                          <span className="text-xs text-gray-400 font-mono mt-0.5 w-5 flex-shrink-0">
                            {ti + 1}.
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {t.title}
                            </p>
                            {t.description && (
                              <p className="text-xs text-gray-400 line-clamp-2">
                                {t.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} fullWidth>
          ← Back
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving} fullWidth>
          Save to Curriculum ({totalTopics} topics)
        </Button>
      </div>
    </div>
  );
}

// ─── AI Parser Tab (2 steps: Upload → Review) ────────────────────────────────

function AIParserTab({ onCurriculumSaved }) {
  const [step, setStep] = useState(1);
  const [parsed, setParsed] = useState(null);

  const steps = [
    { n: 1, label: "Upload Book" },
    { n: 2, label: "Review & Save" },
  ];

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
        {steps.map((s, idx) => (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === s.n
                  ? "bg-indigo-600 text-white"
                  : step > s.n
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {step > s.n ? "✓" : s.n}
            </div>
            <span
              className={`text-sm font-medium ${
                step === s.n ? "text-indigo-700" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <div
                className={`w-10 h-px mx-1 ${
                  step > s.n ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <UploadStep
          onParsed={(data) => {
            setParsed(data);
            setStep(2);
          }}
        />
      )}
      {step === 2 && parsed && (
        <ReviewStep
          parsed={parsed}
          onSave={() => {
            onCurriculumSaved();
            setStep(1);
            setParsed(null);
          }}
          onBack={() => setStep(1)}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminCurriculum() {
  const [subjects, setSubjects] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("library");

  const load = async () => {
    setLoading(true);
    try {
      const [subjectsRes, schoolsRes] = await Promise.all([
        adminService.getSubjects(),
        adminService.getSchools().catch(() => ({ data: [] })),
      ]);
      setSubjects(subjectsRes.data || []);
      setSchools(schoolsRes.data || []);
    } catch {
      setError("Failed to load curriculum.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const tabs = [
    { key: "library", label: "Curriculum Library", Icon: BookOpenIcon },
    { key: "parser", label: "AI Book Parser", Icon: SparklesIcon },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Curriculum</h1>
        <span className="text-sm text-gray-400">{subjects.length} subjects</span>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.Icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "library" ? (
        <LibraryTab
          subjects={subjects}
          schools={schools}
          loading={loading}
          onRefresh={load}
        />
      ) : (
        <AIParserTab
          onCurriculumSaved={() => {
            load();
            setActiveTab("library");
          }}
        />
      )}
    </div>
  );
}
