import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import toast from "react-hot-toast";

const STATUS_LABEL = {
  ready: { text: "Ready", color: "bg-gray-100 text-gray-600" },
  script_ready: { text: "Script Ready", color: "bg-blue-100 text-blue-700" },
  audio_ready: { text: "Audio Ready", color: "bg-purple-100 text-purple-700" },
  whiteboard: { text: "Whiteboard Done", color: "bg-amber-100 text-amber-700" },
  avatar_ready: { text: "Avatar Ready", color: "bg-green-100 text-green-700" },
  done: { text: "Complete", color: "bg-emerald-100 text-emerald-700" },
};

export default function AvatarVideos() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState({}); // templateId → bool
  const [previews, setPreviews] = useState({}); // templateId → local blob URL

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const res = await teacherService.getVideoTemplates();
      setTemplates(res.data.templates || []);
    } catch {
      toast.error("Failed to load video templates");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(templateId, file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG or PNG)");
      return;
    }

    // Show local preview immediately
    const blobUrl = URL.createObjectURL(file);
    setPreviews((p) => ({ ...p, [templateId]: blobUrl }));

    setGenerating((g) => ({ ...g, [templateId]: true }));
    const toastId = toast.loading("Generating avatar video… (~45 sec)");

    try {
      const res = await teacherService.regenerateAvatar(
        user.id,
        templateId,
        file,
      );
      toast.success("Avatar video ready!", { id: toastId });
      // Update the template in state
      setTemplates((ts) =>
        ts.map((t) =>
          t.id === templateId
            ? { ...t, avatar_url: res.data.avatar_url, status: "avatar_ready" }
            : t,
        ),
      );
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      toast.error(`Failed: ${msg}`, { id: toastId });
    } finally {
      setGenerating((g) => ({ ...g, [templateId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const withAudio = templates.filter((t) => t.audio_url);
  const withoutAudio = templates.filter((t) => !t.audio_url);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Avatar Videos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload your photo to personalise the AI teacher avatar for each topic.
          Videos are generated with a default face first — upload yours to
          replace it.
        </p>
      </div>

      {withoutAudio.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          {withoutAudio.length} topic(s) don't have audio yet — ask your admin
          to generate scripts first.
        </div>
      )}

      {withAudio.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No video templates available yet. Ask your admin to generate video
          scripts.
        </div>
      ) : (
        <div className="grid gap-4">
          {withAudio.map((t) => (
            <TopicAvatarCard
              key={t.id}
              template={t}
              preview={previews[t.id]}
              isGenerating={!!generating[t.id]}
              onUpload={(file) => handleUpload(t.id, file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicAvatarCard({ template, preview, isGenerating, onUpload }) {
  const fileRef = useRef();
  const statusInfo = STATUS_LABEL[template.status] || STATUS_LABEL["ready"];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-5 items-start">
      {/* Avatar preview */}
      <div className="shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
        {preview ? (
          <img
            src={preview}
            alt="Your photo"
            className="w-full h-full object-cover"
          />
        ) : template.avatar_url ? (
          <span className="text-xs text-center text-gray-400 px-1">
            Avatar ready
          </span>
        ) : (
          <span className="text-xs text-center text-gray-400 px-1">
            Default face
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900 truncate">
              {template.topic_title}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {template.subject_name}
            </p>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusInfo.color}`}
          >
            {statusInfo.text}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {/* Upload button */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isGenerating}
            className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isGenerating ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                Generating…
              </span>
            ) : template.avatar_url ? (
              "Replace My Photo"
            ) : (
              "Upload My Photo"
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onUpload(e.target.files[0])}
          />

          {/* Preview link */}
          {template.avatar_url && !isGenerating && (
            <a
              href={`http://localhost:8000${template.avatar_url}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Preview avatar ↗
            </a>
          )}
        </div>

        {!template.avatar_url && !isGenerating && (
          <p className="text-xs text-gray-400 mt-2">
            A default avatar will be used until you upload your photo.
          </p>
        )}
      </div>
    </div>
  );
}
