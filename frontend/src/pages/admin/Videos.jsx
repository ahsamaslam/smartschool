import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import adminService from "../../services/adminService";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import Input from "../../components/common/Input";
import Dropdown from "../../components/common/Dropdown";
import { formatDate } from "../../utils/formatters";
import toast from "react-hot-toast";

export default function AdminVideos() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    topic_id: "",
    title: "",
    video_url: "",
    duration_seconds: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminService
      .getVideoTemplates()
      .then((res) => setTemplates(res.data || []))
      .catch(() => setError("Failed to load video templates."))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminService.createVideoTemplate(user.id, {
        topic_id: form.topic_id,
        title: form.title,
        video_url: form.video_url,
        duration_seconds: Number(form.duration_seconds),
      });
      toast.success("Video template created!");
      setShowModal(false);
    } catch {
      toast.error("Failed to create video template.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Video Templates</h1>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          + Add Video
        </Button>
      </div>
      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left py-3 px-4">Title</th>
                <th className="text-left py-3 px-4">Subject</th>
                <th className="text-left py-3 px-4">Topic</th>
                <th className="text-center py-3 px-4">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {t.title}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{t.subject_name}</td>
                  <td className="py-3 px-4 text-gray-500">{t.topic_title}</td>
                  <td className="py-3 px-4 text-center text-gray-500">
                    {t.duration_seconds
                      ? `${Math.round(t.duration_seconds / 60)} min`
                      : "—"}
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-sm text-gray-400"
                  >
                    No video templates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Video Template"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Topic ID"
            value={form.topic_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, topic_id: e.target.value }))
            }
            placeholder="UUID"
            required
          />
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <Input
            label="Video URL"
            value={form.video_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, video_url: e.target.value }))
            }
            placeholder="https://…"
            required
          />
          <Input
            label="Duration (seconds)"
            type="number"
            value={form.duration_seconds}
            onChange={(e) =>
              setForm((f) => ({ ...f, duration_seconds: e.target.value }))
            }
            min={1}
            required
          />
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Create Template
          </Button>
        </form>
      </Modal>
    </div>
  );
}
