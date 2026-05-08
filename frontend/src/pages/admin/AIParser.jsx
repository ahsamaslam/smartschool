import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageSpinner } from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
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
  BookOpenIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// ============================================
// STEP 1: UPLOAD & CONTEXT SELECTION
// ============================================

function UploadStep({ onNext }) {
  const [file, setFile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [metadata, setMetadata] = useState({
    title: "",
    author: "",
    board_name: "",
    edition_year: "",
  });
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    const loadData = async () => {
      try {
        const classesRes = await libraryService.getLibraryClasses();
        const classesData = Array.isArray(classesRes.data) 
          ? classesRes.data 
          : (classesRes.data?.data || []);
        
        setClasses(classesData);
        console.log("Loaded library classes:", classesData);
      } catch (err) {
        console.error("Failed to load library classes:", err);
        toast.error("Failed to load library classes");
      }
    };
    loadData();
  }, []);

  // Load subjects when class changes
  useEffect(() => {
    const loadSubjects = async () => {
      if (!selectedClass) {
        setSubjects([]);
        setSelectedSubject("");
        return;
      }
      
      try {
        const res = await libraryService.getClassSubjects(selectedClass);
        const subjectsData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setSubjects(subjectsData);
        console.log("Loaded subjects for class:", subjectsData);
        
        if (subjectsData.length === 0) {
          const className = classes.find(c => c.id === selectedClass)?.name || "this class";
          toast.error(`No subjects found for ${className}. Please add subjects in Library first.`);
        }
      } catch (err) {
        console.error("Failed to load subjects:", err);
        toast.error("Failed to load subjects");
      }
    };
    loadSubjects();
  }, [selectedClass, classes]);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.match(/\.(pdf|txt|md|docx)$/i)) {
      toast.error("Please upload a PDF, TXT, MD, or DOCX file");
      return;
    }
    setFile(f);
    // Auto-fill title from filename
    if (!metadata.title) {
      const titleFromFile = f.name.replace(/\.(pdf|txt|md|docx)$/i, "");
      setMetadata((m) => ({ ...m, title: titleFromFile }));
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleParse = async () => {
    if (!file || !selectedClass || !selectedSubject) {
      toast.error("Please select file, class, and subject");
      return;
    }
    if (!metadata.title) {
      toast.error("Please provide a book title");
      return;
    }

    setParsing(true);
    const loadingToast = toast.loading("AI is parsing your book... This may take 1-3 minutes for large PDFs", { duration: 300000 });

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await adminService.parseCurriculumBook(fd);

      toast.success("Book parsed successfully!", { id: loadingToast });

      // Normalize: AI returns { subjects: [{ chapters: [{ number, name, topics }] }] }
      // Flatten all subjects' chapters and map field names to what the backend expects
      const raw = res.data;
      const allChapters = (raw?.subjects || []).flatMap(subj =>
        (subj.chapters || []).map(ch => ({
          chapter_number: ch.chapter_number ?? ch.number ?? 0,
          title: ch.title ?? ch.name ?? "Untitled Chapter",
          topics: (ch.topics || []).map(t => ({
            title: t.title ?? t.name ?? "Untitled Topic",
            content_body: t.content_body ?? t.description ?? t.content ?? "",
          })),
        }))
      );

      // Pass parsed data with context to next step
      onNext({
        parsed: { ...raw, chapters: allChapters },
        context: {
          class_id: selectedClass,
          subject_id: selectedSubject,
          ...metadata,
          edition_year: metadata.edition_year
            ? parseInt(metadata.edition_year)
            : null,
        },
      });
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || "Failed to parse book",
        { id: loadingToast }
      );
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <SparklesIcon className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">AI Book Parser</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
          Upload a curriculum book. Our AI will automatically extract the book title, author, subject, class, board, and organize all chapters and topics. You can review and edit before saving.
        </p>
      </div>

      <div className="space-y-6">
        {/* File Upload */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
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
            <div className="flex items-center justify-center gap-4">
              <DocumentTextIcon className="h-10 w-10 text-green-600" />
              <div className="text-left">
                <p className="font-semibold text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <CloudArrowUpIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm font-semibold text-gray-700">
                Drop your curriculum book here
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports PDF, TXT, Markdown, DOCX — up to 100 MB
              </p>
            </>
          )}
        </div>

        {/* Context Selection */}
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-gray-900">Book Context</h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium">
              AI will detect these
            </span>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            AI will identify the class and subject from the book content. Select manually if needed.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class <span className="text-red-500">*</span>
              </label>
              <Dropdown
                options={(classes || []).map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={selectedClass}
                onChange={setSelectedClass}
                placeholder="Select library class..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <Dropdown
                options={(subjects || []).map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
                value={selectedSubject}
                onChange={setSelectedSubject}
                placeholder={selectedClass ? "Select subject..." : "Select class first"}
                disabled={!selectedClass || subjects.length === 0}
              />
            </div>
          </div>
        </div>

        {/* Book Metadata */}
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-gray-900">Book Metadata</h3>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium">
              AI will auto-fill these
            </span>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Our AI will extract these details automatically. You can edit them if needed.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Book Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={metadata.title}
              onChange={(e) =>
                setMetadata((m) => ({ ...m, title: e.target.value }))
              }
              placeholder="e.g., Computer Science for Class 10"
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Author"
              value={metadata.author}
              onChange={(e) =>
                setMetadata((m) => ({ ...m, author: e.target.value }))
              }
              placeholder="e.g., John Smith"
            />

            <Input
              label="Board Name"
              value={metadata.board_name}
              onChange={(e) =>
                setMetadata((m) => ({ ...m, board_name: e.target.value }))
              }
              placeholder="e.g., Cambridge, Oxford"
            />
          </div>

          <Input
            label="Edition Year"
            type="number"
            value={metadata.edition_year}
            onChange={(e) =>
              setMetadata((m) => ({ ...m, edition_year: e.target.value }))
            }
            placeholder="e.g., 2024"
          />
        </div>

        {/* Parse Button */}
        <Button
          variant="primary"
          onClick={handleParse}
          loading={parsing}
          disabled={!file || !selectedClass || !selectedSubject || !metadata.title}
          fullWidth
          className="h-12 text-base"
        >
          {parsing ? (
            <>
              <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
              AI is Parsing...
            </>
          ) : (
            <>
              <SparklesIcon className="h-5 w-5 mr-2" />
              Parse Book with AI
            </>
          )}
        </Button>

        {parsing && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-700">
            <ArrowPathIcon className="h-4 w-4 inline mr-2 animate-spin" />
            Our AI is reading and structuring your book. This typically takes 30-60 seconds depending on file size...
          </div>
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

  const { parsed, context } = data;

  useEffect(() => {
    // Auto-expand first chapter
    if (parsed?.chapters?.length > 0) {
      setExpanded({ 0: true });
    }
  }, [parsed]);

  const totalTopics = (parsed?.chapters || []).reduce(
    (sum, ch) => sum + (ch.topics || []).length,
    0
  );

  const handleSave = async () => {
    setSaving(true);
    const loadingToast = toast.loading("Saving book to library...");

    try {
      await libraryService.saveParsedBook({
        class_id: context.class_id,
        subject_id: context.subject_id,
        title: context.title,
        author: context.author || null,
        board_name: context.board_name || null,
        edition_year: context.edition_year || null,
        pdf_url: context.pdf_url || null,
        chapters: (parsed.chapters || []).map(ch => ({
          chapter_number: ch.chapter_number,
          title: ch.title,
          topics: (ch.topics || []).map(t => ({
            title: t.title,
            content_body: t.content_body || "",
          })),
        })),
      });

      toast.success(
        `Book saved successfully! ${(parsed.chapters || []).length} chapters, ${totalTopics} topics`,
        { id: loadingToast }
      );

      onSave();
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || "Failed to save book",
        { id: loadingToast }
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-6 mb-6 border border-indigo-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircleIcon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {context.title}
            </h2>
            {context.author && (
              <p className="text-sm text-gray-600 mt-1">By {context.author}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {context.board_name && (
                <span className="text-xs bg-white/60 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                  {context.board_name}
                </span>
              )}
              {context.edition_year && (
                <span className="text-xs bg-white/60 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                  {context.edition_year}
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

      {/* Chapters Preview */}
      <div className="space-y-3 mb-6 max-h-[60vh] overflow-y-auto pr-2">
        {(parsed?.chapters || []).map((chapter, idx) => {
          const isExpanded = expanded[idx];
          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
            >
              <button
                onClick={() =>
                  setExpanded((p) => ({ ...p, [idx]: !p[idx] }))
                }
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
                  <p className="font-semibold text-gray-900 truncate">
                    {chapter.title}
                  </p>
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
                          <p className="text-sm font-medium text-gray-800">
                            {topic.title}
                          </p>
                          {topic.content_body && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {topic.content_body}
                            </p>
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

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="secondary"
          onClick={onBack}
          disabled={saving}
          fullWidth
        >
          ← Back
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          fullWidth
          className="h-12"
        >
          {saving ? (
            <>
              <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              Save to Library ({totalTopics} topics)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MAIN AI PARSER PAGE
// ============================================

export default function AIParserPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [parsedData, setParsedData] = useState(null);

  // Debug log
  console.log("AIParserPage rendered", { step });

  // Error boundary check
  if (!navigate) {
    return <div className="p-6">Navigation error</div>;
  }

  const steps = [
    { n: 1, label: "Upload & Configure" },
    { n: 2, label: "Review & Save" },
  ];

  const handleNext = (data) => {
    setParsedData(data);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSave = () => {
    toast.success("Redirecting to library...");
    setTimeout(() => {
      navigate("/admin/library");
    }, 1500);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      {/* Step Indicator */}
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
                step === s.n
                  ? "text-indigo-700"
                  : step > s.n
                  ? "text-green-600"
                  : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 ${
                  step > s.n ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Steps */}
      {step === 1 && <UploadStep onNext={handleNext} />}
      {step === 2 && parsedData && (
        <ReviewStep data={parsedData} onBack={handleBack} onSave={handleSave} />
      )}
    </div>
  );
}
