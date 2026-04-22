import { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import teacherService from "../../services/teacherService";
import Dropdown from "../common/Dropdown";
import { PageSpinner } from "../common/Spinner";

/**
 * LectureViewer — teacher preview only.
 * Does NOT track viewership events (no buffer_video_event calls).
 */
export default function LectureViewer() {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teacherService
      .getVideoTemplates()
      .then((res) => setTemplates(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setVideo(null);
      return;
    }
    const found = templates.find((t) => t.id === selectedId);
    setVideo(found || null);
  }, [selectedId, templates]);

  const options = templates.map((t) => ({
    value: t.id,
    label: `${t.subject_name} — ${t.title}`,
  }));

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Video
        </label>
        <Dropdown
          options={options}
          value={selectedId}
          onChange={setSelectedId}
          placeholder="Choose a video to preview…"
        />
      </div>

      {video ? (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-800">{video.title}</h3>
          <p className="text-xs text-gray-400">
            {video.subject_name} · {video.topic_title}
          </p>
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            <ReactPlayer
              url={video.video_url}
              controls
              width="100%"
              height="100%"
              config={{
                file: {
                  attributes: {
                    controlsList: "nodownload",
                    onContextMenu: (e) => e.preventDefault(),
                  },
                },
              }}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl text-sm text-gray-400">
          Select a video to preview
        </div>
      )}
    </div>
  );
}
