import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import libraryService from "../../services/libraryService";
import teacherService from "../../services/teacherService";
import { useAuth } from "../../context/AuthContext";
import { PageSpinner } from "../../components/common/Spinner";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace("/api", "");

export default function TopicLecturePlayer() {
  const { topicId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState(null);
  const [speed, setSpeed] = useState(1);
  const videoRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        let row;
        if (user?.role === "student") {
          // Students get their assigned teacher's content via the learning endpoint
          const res = await libraryService.getTopic(topicId);
          row = res?.data?.data ?? res?.data;
        } else {
          // All other roles see their own personal content
          const res = await teacherService.getMyTopicContent(topicId);
          const raw = res?.data?.data ?? res?.data;
          row = raw ? { ...raw, id: raw.library_topic_id || raw.id } : null;
        }
        if (!cancel) setTopic(row || null);
      } catch {
        if (!cancel) toast.error("Failed to load lecture.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [topicId, user?.role]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = Number(speed || 1);
  }, [speed]);

  const lectureMeta = useMemo(() => {
    const raw = topic?.lecture_metadata_json;
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return typeof raw === "object" ? raw : null;
  }, [topic?.lecture_metadata_json]);

  const lectureUrl = topic?.lecture_video_url ? `${API_BASE}${topic.lecture_video_url}` : "";
  const markers = Array.isArray(lectureMeta?.slideTimestamps) ? lectureMeta.slideTimestamps : [];

  if (loading) return <PageSpinner />;

  if (!topic || !lectureUrl) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Lecture not available</h1>
          <p className="text-sm text-gray-500 mb-5">
            This topic has no recorded lecture yet.
          </p>
          <Link to="/admin/library" className="text-indigo-600 font-semibold">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{topic.title}</h1>
      <p className="text-sm text-gray-500 mb-5">
        Recorded lecture · Quality {lectureMeta?.quality || "720p"}
      </p>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <video
          ref={videoRef}
          src={lectureUrl}
          controls
          className="w-full rounded-xl border border-gray-200 bg-black"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">Playback speed</label>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
          <button
            type="button"
            onClick={() => videoRef.current?.requestFullscreen?.()}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50"
          >
            Fullscreen
          </button>
        </div>

        {markers.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-gray-700 mb-2">Slide timeline</p>
            <div className="flex flex-wrap gap-2">
              {markers.map((m, idx) => (
                <button
                  key={`${m.slide}-${idx}`}
                  type="button"
                  onClick={() => {
                    if (!videoRef.current) return;
                    videoRef.current.currentTime = Number(m.time || 0);
                    void videoRef.current.play().catch(() => {});
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                >
                  Slide {m.slide} · {Math.floor(Number(m.time || 0))}s
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

