import { useEffect, useRef, useState, useCallback } from "react";
import ReactPlayer from "react-player";
import videoService from "../../services/videoService";

/**
 * VideoPlayer component
 * - Pauses on tab visibility change (Page Visibility API)
 * - Tracks play/pause/complete events to backend
 * - Reports current playback position on unmount
 */
export default function VideoPlayer({ videoUrl, sessionId, duration }) {
  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const currentTimeRef = useRef(0);

  // Pause on tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && playing) {
        setPlaying(false);
        track("pause");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [playing]);

  const track = useCallback(
    (eventType) => {
      if (!sessionId) return;
      videoService
        .trackEvent(sessionId, eventType, currentTimeRef.current)
        .catch(() => {});
    },
    [sessionId],
  );

  const handlePlay = () => {
    setPlaying(true);
    track("play");
  };

  const handlePause = () => {
    setPlaying(false);
    track("pause");
  };

  const handleEnded = () => {
    setPlaying(false);
    track("complete");
  };

  const handleProgress = ({ playedSeconds }) => {
    currentTimeRef.current = Math.round(playedSeconds);
  };

  const handleSeek = (seconds) => {
    currentTimeRef.current = Math.round(seconds);
    track("seek");
  };

  return (
    <div className="relative w-full bg-black rounded-xl overflow-hidden aspect-video">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin h-10 w-10 rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      )}
      <ReactPlayer
        ref={playerRef}
        url={videoUrl}
        playing={playing}
        controls
        width="100%"
        height="100%"
        onReady={() => setReady(true)}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onProgress={handleProgress}
        onSeek={handleSeek}
        progressInterval={5000}
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
  );
}
