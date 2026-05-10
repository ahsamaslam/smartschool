import { useState, useEffect, useMemo } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Dropdown from "../common/Dropdown";
import Alert from "../common/Alert";
import {
  EXAM_QUESTION_TYPES,
  EXAM_COMPLEXITY_OPTIONS,
} from "../../utils/constants";
import examService from "../../services/examService";
import teacherService from "../../services/teacherService";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";

const DEFAULT_ROW = { type: "mcq", count: 10 };

const SCOPE_OPTIONS = [
  { value: "topics", label: "Specific topics" },
  { value: "chapter", label: "Whole chapter" },
  { value: "book", label: "Whole book (all chapters)" },
];

export default function ExamCreateModal({ isOpen, onClose, onCreated }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);

  // Step 1 — pattern
  const [rows, setRows] = useState([{ type: "mcq", count: 10 }]);

  // Step 2 — details
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  /** @type {{ mode: 'flat_legacy', subjects: any[] } | { mode: 'library_tree', boards: any[] } | null} */
  const [examScope, setExamScope] = useState(null);

  const [boardId, setBoardId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [bookId, setBookId] = useState("");
  const [chapterId, setChapterId] = useState("");
  /** @type {'topics' | 'chapter' | 'book'} */
  const [scopeKind, setScopeKind] = useState("topics");

  const [selectedTopics, setSelectedTopics] = useState([]);
  const [complexity, setComplexity] = useState("medium");
  const [title, setTitle] = useState("");

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [loadingEnrollmentPreview, setLoadingEnrollmentPreview] =
    useState(false);
  /** @type {{ count: number, sample_students: { id: string, full_name: string, email?: string }[] } | null} */
  const [enrollmentPreview, setEnrollmentPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setRows([{ type: "mcq", count: 10 }]);
      setClassId("");
      setExamScope(null);
      setBoardId("");
      setSubjectId("");
      setBookId("");
      setChapterId("");
      setScopeKind("topics");
      setSelectedTopics([]);
      setComplexity("medium");
      setTitle("");
      setError("");
      setEnrollmentPreview(null);
    }
  }, [isOpen]);

  // Load classes on step 2
  useEffect(() => {
    if (step !== 2 || !user?.id) return;
    setLoadingClasses(true);
    teacherService
      .getClasses(user.id)
      .then((res) => {
        const cls = res.data || [];
        setClasses(cls);
        if (cls.length) setClassId(cls[0].id);
      })
      .catch(() => setError("Failed to load classes."))
      .finally(() => setLoadingClasses(false));
  }, [step, user?.id]);

  // Broadcast preview: enrolled students for selected section (no manual student list)
  useEffect(() => {
    if (step !== 2 || !classId) {
      setEnrollmentPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingEnrollmentPreview(true);
    examService
      .getEnrollmentPreview(classId)
      .then((res) => {
        if (!cancelled) setEnrollmentPreview(res.data);
      })
      .catch(() => {
        if (!cancelled) setEnrollmentPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingEnrollmentPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, classId]);

  // Load exam scope when class changes
  useEffect(() => {
    if (!classId) return;
    setLoadingCurriculum(true);
    setError("");
    setExamScope(null);
    setBoardId("");
    setSubjectId("");
    setBookId("");
    setChapterId("");
    setScopeKind("topics");
    setSelectedTopics([]);

    examService
      .getClassExamScope(classId)
      .then((res) => {
        const body = res.data;
        setExamScope(body);
        if (body.mode === "flat_legacy" && body.subjects?.length) {
          setSubjectId(body.subjects[0].id);
        } else if (body.mode === "library_tree" && body.boards?.length) {
          const b0 = body.boards[0];
          setBoardId(b0.id);
          const s0 = b0.subjects?.[0];
          if (s0) {
            setSubjectId(s0.id);
            const bk0 = s0.books?.[0];
            if (bk0) {
              setBookId(bk0.id);
              const ch0 = bk0.chapters?.[0];
              if (ch0) setChapterId(ch0.id);
            }
          }
        }
      })
      .catch((err) => {
        setError(
          err?.response?.data?.detail ||
            err?.message ||
            "Failed to load curriculum.",
        );
        setExamScope(null);
      })
      .finally(() => setLoadingCurriculum(false));
  }, [classId]);

  const currentBoard = useMemo(() => {
    if (examScope?.mode !== "library_tree" || !boardId) return null;
    return (examScope.boards || []).find((b) => b.id === boardId) || null;
  }, [examScope, boardId]);

  const boardOptions = useMemo(() => {
    if (examScope?.mode !== "library_tree") return [];
    return (examScope.boards || []).map((b) => ({
      value: b.id,
      label: b.name,
    }));
  }, [examScope]);

  const subjectOptionsLib = useMemo(() => {
    if (!currentBoard?.subjects) return [];
    return currentBoard.subjects.map((s) => ({
      value: s.id,
      label: s.name,
    }));
  }, [currentBoard]);

  const currentSubjectLib = useMemo(() => {
    if (!currentBoard?.subjects || !subjectId) return null;
    return currentBoard.subjects.find((s) => s.id === subjectId) || null;
  }, [currentBoard, subjectId]);

  const bookOptions = useMemo(() => {
    if (!currentSubjectLib?.books) return [];
    return currentSubjectLib.books.map((bk) => ({
      value: bk.id,
      label: bk.title,
    }));
  }, [currentSubjectLib]);

  const currentBook = useMemo(() => {
    if (!currentSubjectLib?.books || !bookId) return null;
    return currentSubjectLib.books.find((b) => b.id === bookId) || null;
  }, [currentSubjectLib, bookId]);

  const chapterOptions = useMemo(() => {
    if (!currentBook?.chapters) return [];
    return currentBook.chapters.map((ch) => ({
      value: ch.id,
      label: `Ch. ${ch.chapter_number}: ${ch.title}`,
    }));
  }, [currentBook]);

  const currentChapter = useMemo(() => {
    if (!currentBook?.chapters || !chapterId) return null;
    return currentBook.chapters.find((c) => c.id === chapterId) || null;
  }, [currentBook, chapterId]);

  // Auto-suggest title
  useEffect(() => {
    const labels = { easy: "Easy", medium: "Mid-Term", hard: "Final" };
    const lab = labels[complexity] || "";
    if (examScope?.mode === "flat_legacy") {
      const sub = examScope.subjects?.find((s) => s.id === subjectId);
      if (sub && complexity) setTitle(`${lab} ${sub.name} Exam`);
      return;
    }
    if (examScope?.mode === "library_tree" && currentSubjectLib && complexity) {
      if (currentBook) {
        setTitle(`${lab} ${currentSubjectLib.name} — ${currentBook.title}`);
      } else {
        setTitle(`${lab} ${currentSubjectLib.name} Exam`);
      }
    }
  }, [
    subjectId,
    complexity,
    examScope,
    currentSubjectLib,
    currentBook,
  ]);

  const handleBoardChange = (v) => {
    setBoardId(v);
    const board = examScope?.boards?.find((b) => b.id === v);
    const s0 = board?.subjects?.[0];
    setSubjectId(s0?.id || "");
    const bk0 = s0?.books?.[0];
    setBookId(bk0?.id || "");
    const ch0 = bk0?.chapters?.[0];
    setChapterId(ch0?.id || "");
    setSelectedTopics([]);
  };

  const handleSubjectChangeLib = (v) => {
    setSubjectId(v);
    const board = examScope?.boards?.find((b) => b.id === boardId);
    const sub = board?.subjects?.find((s) => s.id === v);
    const bk0 = sub?.books?.[0];
    setBookId(bk0?.id || "");
    const ch0 = bk0?.chapters?.[0];
    setChapterId(ch0?.id || "");
    setSelectedTopics([]);
  };

  const handleBookChange = (v) => {
    setBookId(v);
    const sub = currentBoard?.subjects?.find((s) => s.id === subjectId);
    const bk = sub?.books?.find((b) => b.id === v);
    const ch0 = bk?.chapters?.[0];
    setChapterId(ch0?.id || "");
    setSelectedTopics([]);
  };

  const handleChapterChange = (v) => {
    setChapterId(v);
    setSelectedTopics([]);
  };

  // ── Row management ──────────────────────────────────────────────────────────
  const addRow = () => setRows((p) => [...p, { ...DEFAULT_ROW }]);
  const removeRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) =>
    setRows((p) => {
      const n = [...p];
      n[i] = { ...n[i], [field]: value };
      return n;
    });

  // ── Topic multi-select (flat legacy) ────────────────────────────────────────
  const currentSubjectFlat = examScope?.subjects?.find(
    (s) => s.id === subjectId,
  );
  const toggleTopic = (id) =>
    setSelectedTopics((p) =>
      p.includes(id) ? p.filter((t) => t !== id) : [...p, id],
    );
  const toggleAllTopicsFlat = () => {
    const all = (currentSubjectFlat?.topics || []).map((t) => t.id);
    setSelectedTopics((p) => (p.length === all.length ? [] : all));
  };

  const toggleTopicLib = (id) =>
    setSelectedTopics((p) =>
      p.includes(id) ? p.filter((t) => t !== id) : [...p, id],
    );
  const toggleAllTopicsLib = () => {
    const all = (currentChapter?.topics || []).map((t) => t.id);
    setSelectedTopics((p) => (p.length === all.length ? [] : all));
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setError("");
    if (!classId) return setError("Please select a class.");
    if (!title.trim()) return setError("Please enter an exam title.");

    const exam_format = rows.reduce((acc, r) => {
      if (Number(r.count) > 0)
        acc[r.type] = (acc[r.type] || 0) + Number(r.count);
      return acc;
    }, {});

    if (!Object.keys(exam_format).length)
      return setError("Add at least one question type.");

    const payload = {
      teacher_id: user.id,
      class_id: classId,
      title: title.trim(),
      complexity,
      exam_format,
    };

    if (examScope?.mode === "flat_legacy") {
      if (!subjectId) return setError("Please select a subject.");
      if (!selectedTopics.length)
        return setError("Select at least one topic.");
      payload.subject_id = subjectId;
      payload.topic_ids = selectedTopics;
    } else if (examScope?.mode === "library_tree") {
      if (!examScope.boards?.length) {
        return setError(
          "No curriculum linked. Assign a board, subjects, and books to this class in the Library.",
        );
      }
      if (!subjectId || !bookId)
        return setError("Select subject and book.");
      payload.subject_id = subjectId;
      if (boardId) payload.board_id = boardId;
      if (scopeKind === "book") {
        payload.book_id = bookId;
      } else if (scopeKind === "chapter") {
        if (!chapterId) return setError("Select a chapter.");
        payload.chapter_id = chapterId;
      } else {
        if (!chapterId) return setError("Select a chapter.");
        if (!selectedTopics.length)
          return setError("Select at least one topic.");
        payload.topic_ids = selectedTopics;
      }
    } else {
      return setError(
        "Could not load curriculum. Try another class or check your Library setup.",
      );
    }

    setGenerating(true);
    try {
      const res = await examService.createExam(payload);
      toast.success("Exam created successfully!");
      onCreated(res.data);
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        "Failed to generate exam. Please try again.";
      setError(
        typeof msg === "string" ? msg : JSON.stringify(msg) || "Error",
      );
    } finally {
      setGenerating(false);
    }
  };

  const classOptions = classes.map((c) => ({ value: c.id, label: c.name }));
  const subjectOptionsFlat = (examScope?.subjects || []).map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const totalQuestions = rows.reduce((s, r) => s + Number(r.count || 0), 0);

  const libraryTreeEmpty =
    examScope?.mode === "library_tree" &&
    (!examScope.boards || examScope.boards.length === 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Exam" size="xl">
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {[1, 2].map((s, idx) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step >= s
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {s}
              </div>
              <span
                className={`text-sm font-medium ${
                  step >= s ? "text-gray-800" : "text-gray-400"
                }`}
              >
                {s === 1 ? "Question Pattern" : "Details"}
              </span>
            </div>
            {idx === 0 && <div className="flex-1 h-px bg-gray-200 mx-3" />}
          </div>
        ))}
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">
              Question Breakdown
            </p>
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1">
                    <Dropdown
                      options={EXAM_QUESTION_TYPES}
                      value={row.type}
                      onChange={(v) => updateRow(idx, "type", v)}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={row.count}
                      onChange={(e) => updateRow(idx, "count", e.target.value)}
                      className="w-20 border border-gray-300 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">Qs</span>
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <PlusIcon className="h-4 w-4" />
              Add question type
            </button>
          </div>

          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-blue-700 font-medium">
              Total questions
            </span>
            <span className="text-lg font-bold text-blue-700">
              {totalQuestions}
            </span>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setError("");
                setStep(2);
              }}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="space-y-5">
          <Dropdown
            label="Class"
            options={classOptions}
            value={classId}
            onChange={setClassId}
            disabled={loadingClasses}
            placeholder={loadingClasses ? "Loading…" : "Select class…"}
          />

          {classId && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              {loadingEnrollmentPreview ? (
                <p className="text-slate-500">Loading enrollment…</p>
              ) : enrollmentPreview ? (
                <>
                  <p>
                    <span className="font-semibold text-slate-900">
                      Students receiving this exam:
                    </span>{" "}
                    <span className="text-lg font-bold text-indigo-700">
                      {enrollmentPreview.count}
                    </span>{" "}
                    enrolled in this section.
                  </p>
                  {enrollmentPreview.sample_students?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-indigo-600 font-medium text-xs">
                        Preview names (sample of up to 25)
                      </summary>
                      <ul className="mt-2 max-h-32 overflow-y-auto space-y-1 text-xs text-slate-600">
                        {enrollmentPreview.sample_students.map((s) => (
                          <li key={s.id}>{s.full_name}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              ) : (
                <p className="text-slate-500">
                  Could not load enrollment preview.
                </p>
              )}
            </div>
          )}

          {loadingCurriculum && (
            <p className="text-sm text-gray-500">Loading curriculum…</p>
          )}

          {!loadingCurriculum && examScope?.mode === "flat_legacy" && (
            <div className="grid grid-cols-2 gap-4">
              <Dropdown
                label="Subject"
                options={subjectOptionsFlat}
                value={subjectId}
                onChange={(v) => {
                  setSubjectId(v);
                  setSelectedTopics([]);
                }}
                disabled={!classId}
                placeholder="Select subject…"
              />
              <Dropdown
                label="Complexity"
                options={EXAM_COMPLEXITY_OPTIONS}
                value={complexity}
                onChange={setComplexity}
              />
            </div>
          )}

          {!loadingCurriculum && examScope?.mode === "library_tree" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Dropdown
                  label="Board"
                  options={boardOptions}
                  value={boardId}
                  onChange={handleBoardChange}
                  disabled={libraryTreeEmpty}
                  placeholder={
                    libraryTreeEmpty ? "No boards" : "Select board…"
                  }
                />
                <Dropdown
                  label="Subject"
                  options={subjectOptionsLib}
                  value={subjectId}
                  onChange={handleSubjectChangeLib}
                  disabled={!boardId || libraryTreeEmpty}
                  placeholder="Select subject…"
                />
              </div>

              <Dropdown
                label="Book"
                options={bookOptions}
                value={bookId}
                onChange={handleBookChange}
                disabled={!subjectId}
                placeholder="Select book…"
              />

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-gray-700 mb-2">
                  Exam coverage
                </legend>
                <div className="flex flex-col gap-2">
                  {SCOPE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="exam-scope-kind"
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        checked={scopeKind === opt.value}
                        onChange={() => {
                          setScopeKind(opt.value);
                          setSelectedTopics([]);
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Whole book uses all topic content from this book in the
                  library (slides + text). Add material under Books if empty.
                </p>
              </fieldset>

              {scopeKind !== "book" && (
                <Dropdown
                  label="Chapter"
                  options={chapterOptions}
                  value={chapterId}
                  onChange={handleChapterChange}
                  disabled={!bookId}
                  placeholder="Select chapter…"
                />
              )}

              {scopeKind === "topics" && currentChapter && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Topics in this chapter
                    </label>
                    <button
                      type="button"
                      onClick={toggleAllTopicsLib}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {(currentChapter.topics || []).length > 0 &&
                      selectedTopics.length ===
                        (currentChapter.topics || []).length
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                  </div>
                  {(currentChapter.topics || []).length === 0 ? (
                    <p className="text-sm text-gray-400 py-3 text-center border rounded-xl">
                      No topics in this chapter. Add topics in the Library.
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                      {(currentChapter.topics || []).map((t) => (
                        <label
                          key={t.id}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                            selectedTopics.includes(t.id)
                              ? "bg-blue-50 text-blue-800"
                              : "hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTopics.includes(t.id)}
                            onChange={() => toggleTopicLib(t.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          {t.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Dropdown
                label="Complexity"
                options={EXAM_COMPLEXITY_OPTIONS}
                value={complexity}
                onChange={setComplexity}
              />
            </div>
          )}

          {!loadingCurriculum &&
            examScope?.mode === "flat_legacy" &&
            currentSubjectFlat && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Topics
                  </label>
                  <button
                    type="button"
                    onClick={toggleAllTopicsFlat}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selectedTopics.length ===
                    (currentSubjectFlat.topics || []).length
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                </div>
                {(currentSubjectFlat.topics || []).length === 0 ? (
                  <p className="text-sm text-gray-400 py-3 text-center border rounded-xl">
                    No topics found for this subject.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                    {(currentSubjectFlat.topics || []).map((t) => (
                      <label
                        key={t.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                          selectedTopics.includes(t.id)
                            ? "bg-blue-50 text-blue-800"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTopics.includes(t.id)}
                          onChange={() => toggleTopic(t.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        {t.title}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

          {libraryTreeEmpty && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              No board or books linked for this class. In Admin → Library,
              assign a board, subjects, and books to this section.
            </p>
          )}

          <Input
            label="Exam Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mid-Term Physics Exam"
            required
          />

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">
              Pattern
            </p>
            <div className="flex flex-wrap gap-2">
              {rows.map((r, i) => {
                const label =
                  EXAM_QUESTION_TYPES.find((t) => t.value === r.type)?.label ||
                  r.type;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full"
                  >
                    {r.count} × {label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between pt-1">
            <Button
              variant="secondary"
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              ← Back
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              loading={generating}
              disabled={
                loadingCurriculum ||
                !examScope ||
                (examScope.mode === "library_tree" && libraryTreeEmpty)
              }
            >
              {generating ? "Generating…" : "Generate Exam"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
