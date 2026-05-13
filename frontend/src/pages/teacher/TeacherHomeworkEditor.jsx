import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import homeworkService from "../../services/homeworkService";
import examService from "../../services/examService";
import { useAuth } from "../../hooks/useAuth";
import { getAdminPreviewTeacherId } from "../../utils/adminPreviewTeacher";
import { PageSpinner } from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Dropdown from "../../components/common/Dropdown";

export default function TeacherHomeworkEditor() {
  const { classId, homeworkId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !homeworkId;

  const teacherIdForScope =
    user?.role === "admin" ? getAdminPreviewTeacherId() || user?.id : user?.id;

  const [loading, setLoading] = useState(!isNew);
  const [scopeLoading, setScopeLoading] = useState(Boolean(isNew && classId));
  const [scope, setScope] = useState(null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [topicId, setTopicId] = useState("");
  const [type, setType] = useState("interactive");
  const [due, setDue] = useState("");
  const [totalMarks, setTotalMarks] = useState("");
  const [allowedExt, setAllowedExt] = useState("pdf,jpg,jpeg,png");
  const [allowLate, setAllowLate] = useState(false);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [saving, setSaving] = useState(false);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiNumMcq, setAiNumMcq] = useState(4);
  const [aiNumText, setAiNumText] = useState(2);
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiGenerating, setAiGenerating] = useState(false);

  const [boardId, setBoardId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [bookId, setBookId] = useState("");
  const [chapterId, setChapterId] = useState("");

  useEffect(() => {
    if (!isNew || !classId || !teacherIdForScope) {
      setScopeLoading(false);
      return;
    }
    setScopeLoading(true);
    homeworkService
      .getTeacherCurriculum(teacherIdForScope, classId)
      .then((res) => setScope(res.data))
      .catch(() =>
        examService.getClassExamScope(classId).then((res) => setScope(res.data)),
      )
      .finally(() => setScopeLoading(false));
  }, [isNew, classId, teacherIdForScope]);

  useEffect(() => {
    if (isNew) return;
    homeworkService
      .teacherGet(homeworkId)
      .then((res) => {
        const h = res.data?.data;
        if (!h) return;
        setTitle(h.title || "");
        setInstructions(h.instructions || "");
        setTopicId(h.library_topic_id || "");
        setType(h.homework_type || "interactive");
        if (h.due_at) setDue(h.due_at.slice(0, 16));
        setAllowLate(Boolean(h.allow_late_submission));
        setTotalMarks(h.total_marks != null ? String(h.total_marks) : "");
        setAllowedExt(h.allowed_file_extensions || "");
        const qs = res.data?.questions || [];
        if (qs.length) {
          setQuestions(qs.map(normalizeQuestionFromApi));
        }
      })
      .catch(() => toast.error("Failed to load homework"))
      .finally(() => setLoading(false));
  }, [homeworkId, isNew]);

  const boards = scope?.boards || [];
  const selectedBoard = boards.find((b) => String(b.id) === String(boardId));
  const selectedSubject = selectedBoard?.subjects?.find(
    (s) => String(s.id) === String(subjectId),
  );
  const selectedBook = selectedSubject?.books?.find(
    (bk) => String(bk.id) === String(bookId),
  );
  const chapters = selectedBook?.chapters || [];
  const selectedChapter = chapters.find((c) => String(c.id) === String(chapterId));
  const topics = selectedChapter?.topics || [];

  const saveDraft = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (isNew && scope?.mode === "library_tree" && boards.length > 0) {
      if (!topicId.trim()) {
        toast.error("Select board → subject → book → chapter → topic");
        return;
      }
    } else if (isNew && !topicId.trim()) {
      toast.error("Select or enter a library topic");
      return;
    }
    if (type === "interactive") {
      const filled = questions.filter((q) => q.question_text.trim());
      const bad = validateInteractiveQuestions(filled);
      if (bad) {
        toast.error(bad);
        return;
      }
    }
    setSaving(true);
    try {
      if (isNew) {
        const filled = questions.filter((q) => q.question_text.trim()).map(buildQuestionPayload);
        const body = {
          homework_type: type,
          title: title.trim(),
          instructions: instructions.trim() || null,
          class_id: classId,
          library_topic_id: topicId.trim(),
          total_marks: totalMarks ? Number(totalMarks) : null,
          due_at: due ? new Date(due).toISOString() : null,
          allowed_file_extensions: type === "upload" ? allowedExt : null,
          allow_late_submission: allowLate,
          questions:
            type === "interactive" ? filled : undefined,
        };
        const res = await homeworkService.create(body);
        const id = res.data?.data?.id;
        toast.success("Saved as draft");
        if (id) navigate(`/teacher/classes/${classId}/homework/${id}/edit`, { replace: true });
      } else {
        await homeworkService.update(homeworkId, {
          title: title.trim(),
          instructions: instructions.trim() || null,
          total_marks: totalMarks ? Number(totalMarks) : null,
          due_at: due ? new Date(due).toISOString() : null,
          allowed_file_extensions: type === "upload" ? allowedExt : null,
          allow_late_submission: allowLate,
        });
        if (type === "interactive") {
          const filled = questions.filter((q) => q.question_text.trim()).map(buildQuestionPayload);
          await homeworkService.replaceQuestions(homeworkId, filled);
        }
        toast.success("Updated");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const generateWithAi = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      toast.error("Enter a topic or paste content for the AI to use.");
      return;
    }
    if (!classId) {
      toast.error("Missing class.");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await homeworkService.aiGenerateDraft({
        topic_or_content: prompt,
        class_id: classId,
        library_topic_id: topicId?.trim() || null,
        num_mcq: type === "interactive" ? Number(aiNumMcq) || 0 : 0,
        num_text: type === "interactive" ? Number(aiNumText) || 0 : 0,
        difficulty: aiDifficulty,
      });
      const d = res.data;
      if (d?.title) setTitle(d.title);
      if (d?.instructions != null) setInstructions(d.instructions);
      const qs = d?.questions;
      if (type === "interactive" && Array.isArray(qs) && qs.length) {
        setQuestions(qs.map((q) => normalizeQuestionFromApi({
          question_text: q.question_text,
          marks: q.marks,
          question_type: q.question_type,
          options_json: q.options,
          correct_option_index: q.correct_option_index,
        })));
      }
      if (type === "interactive" && Array.isArray(qs) && qs.length) {
        toast.success("Draft generated — review questions, then save draft.");
      } else {
        toast.success("Title and instructions updated — review, then save draft.");
      }
    } catch (e) {
      const msg = e?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "AI generation failed");
    } finally {
      setAiGenerating(false);
    }
  };

  const publish = async () => {
    if (isNew) {
      await saveDraft();
      return;
    }
    setSaving(true);
    try {
      await homeworkService.publish(homeworkId);
      toast.success("Published to this class");
      navigate(`/teacher/classes/${classId}/homework`);
    } catch {
      toast.error("Publish failed — add questions for interactive homework");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  const showLibraryCascade =
    isNew && scope?.mode === "library_tree" && boards.length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto pb-20">
      <button
        type="button"
        onClick={() => navigate(`/teacher/classes/${classId}/homework`)}
        className="text-sm text-gray-500 mb-6"
      >
        ← Homework list
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isNew ? "New homework" : "Edit homework"}
      </h1>

      <div className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm min-h-[80px]"
          />
        </div>

        {isNew && (
          <>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={type === "interactive"}
                  onChange={() => setType("interactive")}
                />
                Interactive
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={type === "upload"} onChange={() => setType("upload")} />
                Upload
              </label>
            </div>

            {scopeLoading && (
              <p className="text-sm text-gray-500">Loading topics for your assignments…</p>
            )}

            {!scopeLoading && showLibraryCascade && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">Curriculum topic</p>
                <p className="text-xs text-gray-600">
                  Only subjects and books assigned to you for this class are listed.
                  {scope?.scoped ? "" : " (Full section curriculum — add assignment rows to narrow.)"}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Dropdown
                    label="Board"
                    options={boards.map((b) => ({ value: b.id, label: b.name }))}
                    value={boardId}
                    onChange={(v) => {
                      setBoardId(v);
                      setSubjectId("");
                      setBookId("");
                      setChapterId("");
                      setTopicId("");
                    }}
                  />
                  <Dropdown
                    label="Subject"
                    options={(selectedBoard?.subjects || []).map((s) => ({
                      value: s.id,
                      label: s.name,
                    }))}
                    value={subjectId}
                    onChange={(v) => {
                      setSubjectId(v);
                      setBookId("");
                      setChapterId("");
                      setTopicId("");
                    }}
                    disabled={!boardId}
                  />
                  <Dropdown
                    label="Book"
                    options={(selectedSubject?.books || []).map((bk) => ({
                      value: bk.id,
                      label: bk.title,
                    }))}
                    value={bookId}
                    onChange={(v) => {
                      setBookId(v);
                      setChapterId("");
                      setTopicId("");
                    }}
                    disabled={!subjectId}
                  />
                  <Dropdown
                    label="Chapter"
                    options={chapters.map((c) => ({
                      value: c.id,
                      label:
                        c.title != null && String(c.title).trim()
                          ? `Ch ${c.chapter_number ?? ""}: ${c.title}`.trim()
                          : `Chapter ${c.chapter_number ?? ""}`,
                    }))}
                    value={chapterId}
                    onChange={(v) => {
                      setChapterId(v);
                      setTopicId("");
                    }}
                    disabled={!bookId}
                  />
                  <Dropdown
                    label="Topic"
                    options={topics.map((t) => ({ value: t.id, label: t.title }))}
                    value={topicId}
                    onChange={(v) => setTopicId(v)}
                    disabled={!chapterId}
                  />
                </div>
              </div>
            )}

            {!scopeLoading && !showLibraryCascade && (
              <Input
                label="Library topic ID (UUID)"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                placeholder="from curriculum library"
                required
              />
            )}
          </>
        )}

        {!isNew && (
          <p className="text-xs text-gray-500">
            Topic: <span className="font-mono">{topicId || "—"}</span> (cannot change after create)
          </p>
        )}

        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 space-y-4 shadow-sm">
          <div>
            <h2 className="text-sm font-bold text-violet-950 uppercase tracking-wide">
              Generate with AI
            </h2>
            <p className="text-xs text-violet-800/90 mt-1">
              Describe a topic or paste lesson notes. Optionally pick a curriculum topic above — it is sent to the AI
              for scope. Everything stays a draft until you save.
            </p>
          </div>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. Photosynthesis — stages, chloroplast role, equations… OR paste textbook paragraphs / your outline."
            className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm min-h-[96px]"
          />
          {type === "interactive" ? (
            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <Input
                label="MCQ count"
                type="number"
                min={0}
                max={15}
                value={String(aiNumMcq)}
                onChange={(e) => setAiNumMcq(Math.min(15, Math.max(0, Number(e.target.value) || 0)))}
              />
              <Input
                label="Written questions"
                type="number"
                min={0}
                max={15}
                value={String(aiNumText)}
                onChange={(e) => setAiNumText(Math.min(15, Math.max(0, Number(e.target.value) || 0)))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-600">
              For <strong>Upload</strong> homework, AI fills the title and instructions from your topic or pasted
              content (no auto-questions). Switch to <strong>Interactive</strong> to generate MCQs and written
              questions.
            </p>
          )}
          <Button type="button" variant="secondary" onClick={generateWithAi} loading={aiGenerating}>
            {type === "interactive" ? "Generate homework draft" : "Generate title & instructions"}
          </Button>
        </div>

        <Input
          type="datetime-local"
          label="Due date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer max-w-xl">
          <input
            type="checkbox"
            checked={allowLate}
            onChange={(e) => setAllowLate(e.target.checked)}
            className="mt-1 rounded border-gray-300"
          />
          <span>
            <span className="font-medium">Allow late submission</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              If unchecked, students cannot save drafts or submit after the due date (unless you return work for
              correction).
            </span>
          </span>
        </label>
        <Input
          label="Total marks (optional)"
          value={totalMarks}
          onChange={(e) => setTotalMarks(e.target.value)}
        />

        {type === "upload" && (
          <Input
            label="Allowed file extensions (comma-separated)"
            value={allowedExt}
            onChange={(e) => setAllowedExt(e.target.value)}
            placeholder="pdf,jpg,png"
          />
        )}

        {type === "interactive" && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-800">Questions</p>
            <p className="text-xs text-gray-500">
              Choose <strong>Written answer</strong> or <strong>MCQ</strong>. MCQs are auto-marked on submit.
            </p>
            {questions.map((q, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={q.question_type !== "mcq"}
                      onChange={() => {
                        const next = [...questions];
                        next[idx] = {
                          question_text: q.question_text,
                          marks: q.marks,
                          question_type: "text",
                          options: ["", "", "", ""],
                          correct_option_index: 0,
                        };
                        setQuestions(next);
                      }}
                    />
                    Written answer
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={q.question_type === "mcq"}
                      onChange={() => {
                        const next = [...questions];
                        next[idx] = {
                          ...q,
                          question_type: "mcq",
                          options: q.options?.length ? q.options : ["", "", "", ""],
                          correct_option_index: q.correct_option_index ?? 0,
                        };
                        setQuestions(next);
                      }}
                    />
                    Multiple choice (MCQ)
                  </label>
                </div>
                <textarea
                  value={q.question_text}
                  onChange={(e) => {
                    const next = [...questions];
                    next[idx] = { ...next[idx], question_text: e.target.value };
                    setQuestions(next);
                  }}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm"
                  placeholder="Question text"
                />
                <Input
                  label="Marks"
                  type="number"
                  value={String(q.marks)}
                  onChange={(e) => {
                    const next = [...questions];
                    next[idx] = { ...next[idx], marks: Number(e.target.value) };
                    setQuestions(next);
                  }}
                />
                {q.question_type === "mcq" && (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-700">Options</p>
                    {(q.options || ["", "", "", ""]).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${idx}`}
                          checked={Number(q.correct_option_index) === oi}
                          onChange={() => {
                            const next = [...questions];
                            next[idx] = { ...next[idx], correct_option_index: oi };
                            setQuestions(next);
                          }}
                          className="text-indigo-600"
                          title="Correct answer"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...questions];
                            const opts = [...(next[idx].options || ["", "", "", ""])];
                            opts[oi] = e.target.value;
                            next[idx] = { ...next[idx], options: opts };
                            setQuestions(next);
                          }}
                          placeholder={`Option ${oi + 1}`}
                          className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-xs font-semibold text-indigo-600"
                      onClick={() => {
                        const next = [...questions];
                        next[idx] = {
                          ...next[idx],
                          options: [...(next[idx].options || []), ""],
                        };
                        setQuestions(next);
                      }}
                    >
                      + Add option
                    </button>
                  </div>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setQuestions([...questions, emptyQuestion()])}
            >
              Add question
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mt-10">
        <Button variant="secondary" onClick={saveDraft} loading={saving}>
          Save draft
        </Button>
        {!isNew && (
          <Button variant="primary" onClick={publish} loading={saving}>
            Publish
          </Button>
        )}
      </div>
    </div>
  );
}

function emptyQuestion() {
  return {
    question_text: "",
    marks: 1,
    question_type: "text",
    options: ["", "", "", ""],
    correct_option_index: 0,
  };
}

function normalizeQuestionFromApi(q) {
  let opts = [];
  if (Array.isArray(q.options_json)) opts = [...q.options_json];
  else if (typeof q.options_json === "string") {
    try {
      const p = JSON.parse(q.options_json);
      opts = Array.isArray(p) ? p : [];
    } catch {
      opts = [];
    }
  }
  while (opts.length < 4) opts.push("");
  return {
    question_text: q.question_text || "",
    marks: Number(q.marks) || 1,
    question_type: q.question_type === "mcq" ? "mcq" : "text",
    options: opts,
    correct_option_index: q.correct_option_index ?? 0,
  };
}

function buildQuestionPayload(q) {
  const text = q.question_text.trim();
  const marks = Number(q.marks) || 1;
  if (q.question_type === "mcq") {
    const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
    return {
      question_text: text,
      marks,
      question_type: "mcq",
      options,
      correct_option_index: Number(q.correct_option_index),
    };
  }
  return { question_text: text, marks, question_type: "text" };
}

function validateInteractiveQuestions(list) {
  for (const q of list) {
    if (q.question_type === "mcq") {
      const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
      if (options.length < 2) return "Each MCQ needs at least two non-empty options.";
      const ci = Number(q.correct_option_index);
      if (Number.isNaN(ci) || ci < 0 || ci >= options.length) {
        return "Select which option is correct for each MCQ (use the radio beside each option).";
      }
    }
  }
  return null;
}
