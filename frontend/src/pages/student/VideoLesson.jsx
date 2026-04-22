import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import studentService from "../../services/studentService";
import VideoPlayer from "../../components/student/VideoPlayer";
import QABot from "../../components/student/QABot";
import { PageSpinner } from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";

/**
 * VideoLesson — unified screen per business guide:
 *   1. Video player
 *   2. Q&A Bot below video
 *   3. "Take the Test" button navigates to /student/quiz/:instanceId
 */
export default function VideoLesson() {
  const { videoId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [quizInstanceId, setQuizInstanceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id || !videoId) return;
    studentService
      .getVideoDetails(videoId, user.id)
      .then((res) => {
        setVideo(res.data);
        setQuizInstanceId(res.data?.quiz_instance_id || null);
      })
      .catch(() => setError("Failed to load video."))
      .finally(() => setLoading(false));
  }, [videoId, user?.id]);

  if (loading) return <PageSpinner />;
  if (error)
    return (
      <div className="p-6">
        <Alert type="error" message={error} />
      </div>
    );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Title */}
      <div>
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
          {video?.subject_name}
        </p>
        <h1 className="text-xl font-bold text-gray-900">{video?.title}</h1>
        <p className="text-sm text-gray-500">{video?.topic_title}</p>
      </div>

      {/* Video Player */}
      <VideoPlayer
        videoUrl={video?.final_video_url}
        sessionId={video?.session_id}
        duration={video?.duration_seconds}
      />

      {/* Take the Test CTA */}
      {quizInstanceId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-900 text-sm">
              Ready for the test?
            </p>
            <p className="text-xs text-blue-600">
              This quiz is mandatory to complete the topic.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate(`/student/quiz/${quizInstanceId}`)}
          >
            Take the Test
          </Button>
        </div>
      )}

      {/* Q&A Bot */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Ask the AI Tutor
        </h2>
        <QABot videoId={videoId} />
      </div>
    </div>
  );
}
