import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import teacherService from "../../services/teacherService";
import Button from "../common/Button";
import Dropdown from "../common/Dropdown";
import Alert from "../common/Alert";
import { PageSpinner } from "../common/Spinner";
import toast from "react-hot-toast";

export default function PublishVideoForm({ onPublished }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    video_template_id: "",
    avatar_profile_id: "",
    class_subject_id: "",
    published_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      teacherService.getVideoTemplates(),
      teacherService.getAvatars(user.id),
    ])
      .then(([tRes, aRes]) => {
        setTemplates(tRes.data || []);
        setAvatars(aRes.data || []);
      })
      .catch(() => setError("Failed to load resources."))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.video_template_id) {
      setError("Please select a video template.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await teacherService.publishVideo(user.id, form);
      toast.success("Video published!");
      onPublished?.();
      setForm((f) => ({ ...f, video_template_id: "", avatar_profile_id: "" }));
    } catch {
      setError("Failed to publish video.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  const templateOptions = templates.map((t) => ({
    value: t.id,
    label: `${t.subject_name} — ${t.title}`,
  }));

  const avatarOptions = [
    { value: "", label: "No avatar" },
    ...avatars.map((a) => ({ value: a.id, label: a.avatar_name })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error" message={error} />}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Video Template
        </label>
        <Dropdown
          options={templateOptions}
          value={form.video_template_id}
          onChange={(v) => setForm((f) => ({ ...f, video_template_id: v }))}
          placeholder="Select a video…"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Avatar Profile
        </label>
        <Dropdown
          options={avatarOptions}
          value={form.avatar_profile_id}
          onChange={(v) => setForm((f) => ({ ...f, avatar_profile_id: v }))}
          placeholder="Optional avatar…"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Publish Date
        </label>
        <input
          type="date"
          value={form.published_date}
          onChange={(e) =>
            setForm((f) => ({ ...f, published_date: e.target.value }))
          }
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <Button type="submit" variant="primary" fullWidth loading={saving}>
        Publish Video
      </Button>
    </form>
  );
}
