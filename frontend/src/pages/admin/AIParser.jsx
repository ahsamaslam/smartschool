import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Dropdown from "../../components/common/Dropdown";
import toast from "react-hot-toast";
import adminService from "../../services/adminService";
import libraryService from "../../services/libraryService";
import {
  SparklesIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// ============================================
// STEP 1: UPLOAD & CONFIGURE
// ============================================

function UploadStep({ onNext }) {
  const [file, setFile] = useState(null);
  const [boards, setBoards] = useState([]);
  const [boardSubjects, setBoardSubjects] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedChapters, setParsedChapters] = useState(null); // full parse result

  const [form, setForm] = useState({
    title: "",
    author: "",
    board_id: "",
    subject_id: "",
    edition_year: "",
    grade_level: "",
  });

  const inputRef = useRef();
  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Load boards on mount
  useEffect(() => {
    libraryService.getBoards()
      .then((res) => {
        const data = Array.isArray(res?.data?.data) ? res.data.data : (res?.data || []);
        setBoards(Array.isArray(data) ? data : []);
      })
      .catch(() => toast.error("Failed to load boards"));
  }, []);

  // Load subjects when board changes
  useEffect(() => {
    if (!form.board_id) {
      setBoardSubjects([]);
      setField("subject_id", "");
      return;
    }
    libraryService.getBoardSubjects(form.board_id)
      .then((res) => {
        const data = res?.data?.data || res?.data || [];
        setBoardSubjects(Array.isArray(data) ? data : []);
        setField("subject_id", "");
      })
      .catch(() => toast.error("Failed to load subjects for this board"));
  }, [form.board_id]);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.match(/\.(pdf|txt|md|docx)$/i)) {
      toast.error("Please upload a PDF, TXT, MD, or DOCX file");
      return;
    }
    setFile(f);
    setParsedChapters(null);
    const titleFromFile = f.name.replace(/\.(pdf|txt|md|docx)$/i, "");
    setForm((prev) => ({ ...prev, title: prev.title || titleFromFile }));
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  // Parse book with AI — fills form + extracts chapters
  const handleParseWithAI = async () => {
    if (!file) return;
    setParsing(true);
    const tid = toast.loading("AI is parsing your book… This may take 1–3 minutes", { duration: 300000 });

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await adminService.parseCurriculumBook(fd);
      const raw = res.data;

      // Normalize chapters from the full parse response
      const allChapters = (raw?.subjects || []).flatMap((subj) =>
        (subj.chapters || []).map((ch) => ({
          chapter_number: ch.chapter_number ?? ch.number ?? 1,
          title: ch.title ?? ch.name ?? "Untitled Chapter",
          topics: (ch.topics || []).map((t) => ({
            title: t.title ?? t.name ?? "Untitled Topic",
            content_body: t.content_body ?? t.description ?? t.content ?? "",
          })),
        }))
      );

      const validChapters = allChapters
        .filter((ch) => (ch.title || "").trim())
        .map((ch, idx) => ({
          chapter_number: Number(ch.chapter_number) > 0 ? Number(ch.chapter_number) : idx + 1,
          title: ch.title.trim(),
          topics: (ch.topics || [])
            .filter((t) => (t.title || "").trim())
            .map((t) => ({
              title: t.title.trim(),
              content_body: (t.content_body || "").trim(),
            })),
        }));

      if (validChapters.length === 0) {
        throw new Error("Parser returned no chapters. Try another file or re-parse.");
      }

      setParsedChapters(validChapters);

      // Auto-fill form from what the AI returned
      const updates = {};
      if (raw.book_title) updates.title = raw.book_title;
      if (raw.grade_level) updates.grade_level = raw.grade_level;

      // Try to detect board from grade_level or subject names
      const gradeHint = (raw.grade_level || "").toLowerCase();
      if (boards.length > 0) {
        const match = boards.find((b) => {
          const bn = b.name.toLowerCase();
          return gradeHint.includes(bn) || bn.includes(gradeHint);
        });
        if (match) updates.board_id = match.id;
      }

      setForm((f) => ({ ...f, ...updates }));
      toast.success(`Parsed! ${validChapters.length} chapters found — fill in board & subject, then click Review & Save.`, { id: tid });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to parse book", { id: tid });
    } finally {
      setParsing(false);
    }
  };

  const canProceed =
    parsedChapters?.length > 0 &&
    form.title.trim() &&
    form.board_id &&
    form.subject_id;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <SparklesIcon className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">AI Book Parser</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Upload a book, parse it with AI, then select the board and subject to store it under.
        </p>
      </div>

      <div className="space-y-6">
        {/* ── File Upload ── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-indigo-500 bg-indigo-50 scale-[1.02]"
              : file
              ? "border-green-300 bg-green-50"
              : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,.docx"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {file ? (
            <div className="flex items-center gap-3 flex-wrap">
              <DocumentTextIcon className="h-10 w-10 text-green-600 flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                {parsedChapters && (
                  <p className="text-xs text-green-600 font-medium mt-0.5">
                    ✓ Parsed — {parsedChapters.length} chapters found
                  </p>
                )}
              </div>

              {/* Parse button — right next to file */}
              <button
                onClick={(e) => { e.stopPropagation(); handleParseWithAI(); }}
                disabled={parsing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex-shrink-0"
              >
                {parsing ? (
                  <><ArrowPathIcon className="h-4 w-4 animate-spin" />Parsing…</>
                ) : parsedChapters ? (
                  <><ArrowPathIcon className="h-4 w-4" />Re-parse</>
                ) : (
                  <><SparklesIcon className="h-4 w-4" />Parse with AI</>
                )}
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setParsedChapters(null); }}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <CloudArrowUpIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm font-semibold text-gray-700">Drop your curriculum book here</p>
              <p className="text-xs text-gray-400 mt-1">Supports PDF, TXT, Markdown, DOCX</p>
            </>
          )}
        </div>

        {parsing && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-700">
            <ArrowPathIcon className="h-4 w-4 inline mr-2 animate-spin" />
            Reading and structuring your book — typically 30–90 seconds…
          </div>
        )}

        {/* ── Book Details (only shown after upload) ── */}
        {file && (
          <>
            <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Book Details</h3>
                {parsedChapters && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                    AI auto-filled · edit if needed
                  </span>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="e.g., Computer Science for Class 10"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Author"
                  value={form.author}
                  onChange={(e) => setField("author", e.target.value)}
                  placeholder="e.g., John Smith"
                />
                <Input
                  label="Edition Year"
                  type="number"
                  value={form.edition_year}
                  onChange={(e) => setField("edition_year", e.target.value)}
                  placeholder="e.g., 2024"
                />
              </div>

              <Input
                label="Grade / Class Level"
                value={form.grade_level}
                onChange={(e) => setField("grade_level", e.target.value)}
                placeholder="e.g., Class 9, O Level, Grade 10"
              />
            </div>

            {/* ── Board (required) ── */}
            <div className="bg-gray-50 rounded-2xl p-6 space-y-3">
              <h3 className="font-semibold text-gray-900">
                Board <span className="text-red-500">*</span>
              </h3>
              <p className="text-xs text-gray-500 -mt-1">
                Select a board — subjects shown will be specific to that board.
              </p>
              <Dropdown
                options={boards.map((b) => ({ value: b.id, label: b.name }))}
                value={form.board_id}
                onChange={(val) => setField("board_id", val)}
                placeholder="Select board…"
              />
              {boards.length === 0 && (
                <p className="text-xs text-amber-600">
                  No boards found. Go to Library and create boards first.
                </p>
              )}
            </div>

            {/* ── Subject (required, filtered by board) ── */}
            <div className="bg-gray-50 rounded-2xl p-6 space-y-3">
              <h3 className="font-semibold text-gray-900">
                Subject <span className="text-red-500">*</span>
              </h3>
              <p className="text-xs text-gray-500 -mt-1">
                {form.board_id
                  ? boardSubjects.length === 0
                    ? "No subjects linked to this board yet — add them in Library first."
                    : "Showing subjects for the selected board only."
                  : "Select a board first to see its subjects."}
              </p>
              <Dropdown
                options={(boardSubjects || []).map((s) => ({ value: s.id, label: s.name }))}
                value={form.subject_id}
                onChange={(val) => setField("subject_id", val)}
                placeholder={form.board_id ? "Select subject…" : "Select board first"}
                disabled={!form.board_id || boardSubjects.length === 0}
              />
            </div>

            {/* ── Continue button ── */}
            {parsedChapters && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span>
                  <strong>{parsedChapters.length} chapters</strong> parsed successfully.
                  Select board &amp; subject above, then click <strong>Review Chapters</strong> to check everything before saving.
                </span>
              </div>
            )}

            <Button
              variant="primary"
              onClick={() =>
                onNext({
                  parsed: { chapters: parsedChapters },
                  form: { ...form },
                  boards,
                })
              }
              disabled={!canProceed}
              fullWidth
              className="h-12 text-base"
            >
              <ChevronRightIcon className="h-5 w-5 mr-2" />
              {parsedChapters
                ? `Review ${parsedChapters.length} Chapters & Save`
                : "Parse the book first"}
            </Button>

            {!parsedChapters && (
              <p className="text-center text-xs text-gray-400">
                Click "Parse with AI" next to the file above to continue
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// STEP 2: REVIEW PARSED CONTENT
// ============================================

function ReviewStep({ data, onBack, onSave }) {
  const [expanded, setExpanded] = useState({});
  const [saving, setSaving] = useState(false);

  const { parsed, form, boards } = data;

  useEffect(() => {
    if (parsed?.chapters?.length > 0) setExpanded({ 0: true });
  }, [parsed]);

  const totalTopics = (parsed?.chapters || []).reduce(
    (sum, ch) => sum + (ch.topics || []).length,
    0
  );

  const boardName = boards.find((b) => b.id === form.board_id)?.name || "";

  const handleSave = async () => {
    setSaving(true);
    const tid = toast.loading("Saving book to library…");

    try {
      await libraryService.saveParsedBook({
        board_id: form.board_id,
        subject_id: form.subject_id,
        title: form.title,
        author: form.author || null,
        board_name: boardName || null,
        edition_year: form.edition_year ? parseInt(form.edition_year) : null,
        chapters: (parsed.chapters || []).map((ch) => ({
          chapter_number: ch.chapter_number,
          title: ch.title,
          topics: (ch.topics || []).map((t) => ({
            title: t.title,
            content_body: t.content_body || "",
          })),
        })),
      });

      toast.success(
        `Saved! ${(parsed.chapters || []).length} chapters, ${totalTopics} topics`,
        { id: tid }
      );

      onSave({ boardId: form.board_id });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save book", { id: tid });
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Summary card */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-6 mb-6 border border-indigo-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircleIcon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{form.title}</h2>
            {form.author && <p className="text-sm text-gray-600 mt-1">By {form.author}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {boardName && (
                <span className="text-xs bg-white/60 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                  {boardName}
                </span>
              )}
              {form.grade_level && (
                <span className="text-xs bg-white/60 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                  {form.grade_level}
                </span>
              )}
              {form.edition_year && (
                <span className="text-xs bg-white/60 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                  {form.edition_year}
                </span>
              )}
              <span className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-full font-medium">
                {(parsed?.chapters || []).length} chapters
              </span>
              <span className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-full font-medium">
                {totalTopics} topics
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters */}
      <div className="space-y-3 mb-6 max-h-[60vh] overflow-y-auto pr-2">
        {(parsed?.chapters || []).map((chapter, idx) => {
          const isExpanded = expanded[idx];
          return (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setExpanded((p) => ({ ...p, [idx]: !p[idx] }))}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full flex-shrink-0">
                  Ch {chapter.chapter_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{chapter.title}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
                  {(chapter.topics || []).length} topics
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                  <div className="space-y-2">
                    {(chapter.topics || []).map((topic, topicIdx) => (
                      <div
                        key={topicIdx}
                        className="flex items-start gap-3 bg-white rounded-lg px-4 py-3 border border-gray-100"
                      >
                        <span className="text-xs text-gray-400 font-mono mt-0.5 w-6 flex-shrink-0">
                          {topicIdx + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{topic.title}</p>
                          {topic.content_body && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{topic.content_body}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-4">
        <Button variant="secondary" onClick={onBack} disabled={saving} fullWidth>
          ← Back
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving} fullWidth className="h-12">
          {saving ? (
            <><ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />Saving…</>
          ) : (
            <><CheckCircleIcon className="h-5 w-5 mr-2" />Save to Library ({totalTopics} topics)</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MAIN
// ============================================

export default function AIParserPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [parsedData, setParsedData] = useState(null);

  const steps = [
    { n: 1, label: "Upload & Configure" },
    { n: 2, label: "Review & Save" },
  ];

  const handleSave = ({ boardId }) => {
    if (boardId) {
      toast.success("Redirecting to board…");
      setTimeout(() => navigate(`/admin/library/boards/${boardId}`), 1200);
    } else {
      setTimeout(() => navigate("/admin/library"), 1200);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 mb-10">
        {steps.map((s, idx) => (
          <div key={s.n} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === s.n
                  ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white scale-110"
                  : step > s.n
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {step > s.n ? "✓" : s.n}
            </div>
            <span
              className={`text-sm font-semibold ${
                step === s.n ? "text-indigo-700" : step > s.n ? "text-green-600" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-2 ${step > s.n ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <UploadStep
          onNext={(data) => { setParsedData(data); setStep(2); }}
        />
      )}
      {step === 2 && parsedData && (
        <ReviewStep
          data={parsedData}
          onBack={() => setStep(1)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
