import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FilmIcon,
  ArrowRightIcon,
  PlayCircleIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  ComputerDesktopIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
  PauseIcon,
  StopCircleIcon,
} from "@heroicons/react/24/outline";
import libraryService from "../../services/libraryService";
import { SlideThumbnail } from "../../components/slides/SlideThumbnail";
import { SLIDE_TEMPLATES, SLIDE_ANIMATIONS } from "../../data/slideTemplates";
import { SlideRenderer } from "../../components/slides/SlideRenderer";
import { PageSpinner } from "../../components/common/Spinner";
import { parseLibraryTopicSlidesJson } from "../../utils/libraryTopicSlides";
import { normalizeLibraryTopicId, libraryTopicPresentAbsUrl } from "../../utils/libraryNavigation";

function pickRecorderMime() {
  const cand = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return cand.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
}

function recorderSupportsPause() {
  return typeof MediaRecorder !== "undefined" && typeof MediaRecorder.prototype.pause === "function";
}

/**
 * Recording = screen/tab capture video + microphone audio.
 * Webcam feeds the circular preview only (shows up when you share *this* tab).
 * Camera video can be turned off while mic stays live.
 */
export default function AdminRecordLecture() {
  const { libraryTopicId: topicIdFromRoute } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const topicKey = normalizeLibraryTopicId(
    topicIdFromRoute || location.state?.libraryTopicId || "",
  );

  const initialContext = location.state?.libraryContext || null;

  const [loading, setLoading] = useState(!!topicKey);
  const [topicRow, setTopicRow] = useState(null);
  const [template, setTemplate] = useState(SLIDE_TEMPLATES[0]);

  const [studioOpen, setStudioOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const camVideoRef = useRef(null);

  const micStreamRef = useRef(null);
  const camStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordedMimeRef = useRef("video/webm");

  const [micActive, setMicActive] = useState(false);
  const [camOpened, setCamOpened] = useState(false);
  const [cameraVideoOn, setCameraVideoOn] = useState(true);
  const [screenActive, setScreenActive] = useState(false);

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [camBusy, setCamBusy] = useState(false);

  const [recordedUrl, setRecordedUrl] = useState(null);

  useEffect(() => {
    if (!topicKey) {
      setLoading(false);
      setTopicRow(null);
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await libraryService.getTopic(topicKey, { timeout: 20000 });
        const rowRaw = res.data?.data ?? res.data;
        const row =
          rowRaw && typeof rowRaw === "object" && !Array.isArray(rowRaw) ? rowRaw : null;
        if (!cancel) {
          setTopicRow(row?.id ? row : null);
          if (row?.slide_theme) {
            const found = SLIDE_TEMPLATES.find((t) => t.id === row.slide_theme);
            if (found) setTemplate(found);
          }
        }
      } catch (e) {
        if (!cancel) {
          const st = e?.response?.status;
          const detail = e?.response?.data?.detail;
          toast.error(
            detail ||
              (st === 404
                ? "Topic not found — check Library or sign in."
                : st === 401 || st === 403
                  ? "Not authorized. Sign in again."
                  : `Could not load topic${st ? ` (${st})` : ""}`),
          );
          setTopicRow(null);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [topicKey]);

  const slides = topicRow ? parseLibraryTopicSlidesJson(topicRow.slides_json) : [];
  const hasDeck = slides.length > 0;
  const currentSlide = slides[slideIndex] || null;
  const motionClass =
    SLIDE_ANIMATIONS.find((a) => a.id === (currentSlide?.animation || ""))?.css || "";

  const stopScreen = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenActive(false);
  }, []);

  const stopMic = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setMicActive(false);
  }, []);

  const stopCam = useCallback(() => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    if (camVideoRef.current) camVideoRef.current.srcObject = null;
    setCamOpened(false);
    setCameraVideoOn(true);
  }, []);

  const stopAllMedia = useCallback(() => {
    stopScreen();
    stopMic();
    stopCam();
  }, [stopScreen, stopMic, stopCam]);

  useEffect(() => () => stopAllMedia(), [stopAllMedia]);

  useEffect(() => {
    if (!studioOpen || !topicRow?.title) return undefined;
    const prev = document.title;
    document.title = `Record: ${topicRow.title}`;
    return () => {
      document.title = prev;
    };
  }, [studioOpen, topicRow?.title]);

  /** Microphone only (voice always uses this stream when recording). */
  const startMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone API not available.");
      return;
    }
    setMicBusy(true);
    try {
      stopMic();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      micStreamRef.current = stream;
      setMicActive(true);
      toast.success("Microphone ready");
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        toast.error("Allow microphone for localhost in the browser (lock icon → Site settings).");
      } else {
        toast.error("Could not access microphone.");
      }
    } finally {
      setMicBusy(false);
    }
  };

  /** Webcam video only (shown in bubble; stays off recorder tracks — captured when you share this tab). */
  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera API not available.");
      return;
    }
    setCamBusy(true);
    try {
      stopCam();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      camStreamRef.current = stream;
      setCamOpened(true);
      setCameraVideoOn(true);
      if (camVideoRef.current) {
        camVideoRef.current.srcObject = stream;
        await camVideoRef.current.play().catch(() => {});
      }
      toast.success("Camera preview on");
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        toast.error("Allow camera for this site.");
      } else if (name === "NotFoundError") {
        toast.error("No camera found.");
      } else {
        toast.error("Could not start camera.");
      }
    } finally {
      setCamBusy(false);
    }
  };

  const toggleCameraVideo = () => {
    const tracks = camStreamRef.current?.getVideoTracks?.() ?? [];
    if (!tracks.length) {
      toast.error("Turn the camera on first.");
      return;
    }
    const next = !cameraVideoOn;
    tracks.forEach((t) => {
      t.enabled = next;
    });
    setCameraVideoOn(next);
    toast.success(next ? "Camera picture on" : "Camera picture off (mic still recording if enabled)");
  };

  const startScreenShare = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error("Screen sharing not supported.");
      return;
    }
    setSharingBusy(true);
    try {
      stopScreen();
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });
      screenStreamRef.current = stream;
      setScreenActive(true);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopScreen();
        toast("Screen share ended.", { duration: 2500 });
      });
      toast.success(
        'In the picker choose "Chrome tab", then pick THIS tab — your localhost tab should appear (scroll list). Whole screen/window works too.',
        { duration: 6000 },
      );
    } catch (err) {
      const name = err?.name || "";
      if (name !== "AbortError") {
        toast.error(name === "NotAllowedError" ? "Screen share cancelled or blocked." : "Could not share screen.");
      }
    } finally {
      setSharingBusy(false);
    }
  };

  const startRecording = () => {
    const screen = screenStreamRef.current;
    const mic = micStreamRef.current;
    if (!screen?.getVideoTracks().length) {
      toast.error("Share screen first — pick “Chrome tab” and select THIS tab.");
      return;
    }
    if (!mic?.getAudioTracks().length) {
      toast.error('Turn on the microphone (“Microphone” button). Recording needs your voice.');
      return;
    }

    chunksRef.current = [];
    const out = new MediaStream();
    screen.getVideoTracks().forEach((t) => out.addTrack(t));
    mic.getAudioTracks().forEach((t) => out.addTrack(t));

    const mimePreferred = pickRecorderMime();
    let mr;
    try {
      mr = new MediaRecorder(out, { mimeType: mimePreferred, videoBitsPerSecond: 2_500_000 });
    } catch {
      try {
        mr = new MediaRecorder(out);
      } catch {
        toast.error("Recording failed — try Chrome or Edge (latest).");
        return;
      }
    }

    recordedMimeRef.current = mr.mimeType || mimePreferred;
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const mt = mr.mimeType || recordedMimeRef.current || "video/webm";
      const blob = new Blob(chunksRef.current, { type: mt });
      if (!blob.size) {
        toast.error("Recording produced no data — grant permissions and stay a few seconds on screen.");
      } else {
        const url = URL.createObjectURL(blob);
        setRecordedUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        toast.success("Recording saved — preview below.");
      }
    };

    try {
      mr.start(500);
      recorderRef.current = mr;
      setRecording(true);
      setPaused(false);
    } catch {
      toast.error("Could not start MediaRecorder.");
    }
  };

  const stopRecording = () => {
    const mr = recorderRef.current;
    if (mr?.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        /* noop */
      }
    }
    recorderRef.current = null;
    setRecording(false);
    setPaused(false);
  };

  const togglePause = () => {
    const mr = recorderRef.current;
    if (!mr || mr.state === "inactive") return;
    try {
      if (paused) {
        mr.resume?.();
        setPaused(false);
      } else {
        mr.pause?.();
        setPaused(true);
      }
    } catch {
      toast.error("Pause/resume not supported in this browser.");
    }
  };

  const closeStudio = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") stopRecording();
    stopAllMedia();
    setStudioOpen(false);
    setPaused(false);
  };

  const openSlideStudio = () => {
    if (!topicRow?.id) return;
    navigate("/admin/slides", {
      state: {
        topic: {
          id: topicRow.id,
          title: topicRow.title,
          content_body: topicRow.content_body || "",
          slides_json: topicRow.slides_json,
          slide_theme: topicRow.slide_theme,
        },
        libraryContext: initialContext,
      },
    });
  };

  const goPrevSlide = useCallback(() => setSlideIndex((i) => Math.max(0, i - 1)), []);
  const goNextSlide = useCallback(
    () => setSlideIndex((i) => Math.min(slides.length - 1, i + 1)),
    [slides.length],
  );

  useEffect(() => {
    if (!studioOpen || !hasDeck) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNextSlide();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrevSlide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studioOpen, hasDeck, goNextSlide, goPrevSlide]);

  if (loading) {
    return (
      <div className="p-6">
        <PageSpinner />
      </div>
    );
  }

  if (!topicKey) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Record lecture</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Open Record lecture from the Library on a topic that has slides. Present opens in a new tab so Chrome’s
            picker can capture it easily.
          </p>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100 rounded-2xl p-8 text-center">
          <FilmIcon className="h-14 w-14 mx-auto mb-4 text-rose-400" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Slides + microphone + tab capture</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Use Curriculum Library topic actions. Prefer <strong>Chrome</strong> on <strong>localhost</strong> or{" "}
            <strong>HTTPS</strong>.
          </p>
          <Link
            to="/admin/library"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-xl hover:bg-rose-700 transition-colors shadow-sm"
          >
            Go to Curriculum Library
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (!topicRow?.id) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <p className="text-gray-600 mb-2">Topic not found or you’re not logged in.</p>
        <p className="text-xs text-gray-400 mb-6">Ensure the backend is running and your token is valid.</p>
        <button type="button" onClick={() => navigate("/admin/library")} className="text-indigo-600 font-semibold">
          ← Back to Library
        </button>
      </div>
    );
  }

  const presentAbs = libraryTopicPresentAbsUrl(topicRow.id);

  const studioPortal =
    studioOpen &&
    hasDeck &&
    createPortal(
      <div className="fixed inset-0 z-[10000] flex flex-col bg-black text-white">
        <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/15 bg-neutral-950/90">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/45">Recording studio</p>
            <p className="font-semibold truncate">{topicRow.title}</p>
          </div>
          <button
            type="button"
            onClick={closeStudio}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold"
          >
            Exit studio
          </button>
        </header>

        <div className="flex-1 relative flex items-center justify-center p-4 min-h-0 overflow-hidden bg-neutral-950">
          <div
            className={`relative w-full max-w-5xl rounded-xl shadow-2xl ring-1 ring-white/10 bg-black overflow-hidden ${motionClass}`}
            style={{ aspectRatio: "16/9" }}
          >
            {currentSlide && (
              <SlideRenderer slide={currentSlide} template={template} slideIndex={slideIndex} />
            )}

            <div className="absolute bottom-6 right-6 z-10 pointer-events-none">
              <div
                className={`relative w-[min(36vw,200px)] h-[min(36vw,200px)] sm:w-44 sm:h-44 rounded-full overflow-hidden shadow-2xl ring-[5px] ring-white/95 bg-neutral-900 ${
                  !camOpened || !cameraVideoOn ? "opacity-90" : ""
                }`}
              >
                <video
                  ref={camVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
                    !camOpened || !cameraVideoOn ? "opacity-0" : "opacity-100"
                  }`}
                />
                {(!camOpened || !cameraVideoOn) && (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-wide text-white/55 text-center px-2 bg-black/50">
                    {camOpened ? "Video off · mic still on" : "Camera off"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="flex-shrink-0 border-t border-white/15 bg-black/90 px-4 py-3">
          <div className="max-w-5xl mx-auto flex flex-col gap-3">
            <p className="text-[11px] text-amber-200/95 text-center sm:text-left leading-relaxed">
              <strong>Flow:</strong> Microphone · optional Camera bubble · Share screen → choose <strong>Chrome Tab</strong>{" "}
              → select <strong>this</strong> tab (localhost URLs appear — scroll full list). Then{" "}
              <strong>Start recording</strong>. Use <strong>Camera video off</strong> if you want voice-only in the bubble
              while slides still capture on tab share.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={goPrevSlide}
                disabled={slideIndex === 0 || recording}
                className="px-3 py-2 rounded-xl bg-white/10 text-sm disabled:opacity-35"
              >
                ← Prev
              </button>
              <span className="text-sm font-mono text-white/70 min-w-[5rem] text-center">
                {slideIndex + 1} / {slides.length}
              </span>
              <button
                type="button"
                onClick={goNextSlide}
                disabled={slideIndex >= slides.length - 1 || recording}
                className="px-3 py-2 rounded-xl bg-white/10 text-sm disabled:opacity-35"
              >
                Next →
              </button>
              <span className="w-px h-6 bg-white/15 hidden sm:block mx-1" />

              <button
                type="button"
                onClick={startMic}
                disabled={micBusy || recording}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 ${
                  micActive ? "bg-emerald-800 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                <MicrophoneIcon className="h-4 w-4" />
                {micBusy ? "…" : micActive ? "Mic on" : "Microphone"}
              </button>

              <button
                type="button"
                onClick={startCamera}
                disabled={camBusy || recording}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 ${
                  camOpened ? "bg-rose-800 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
                }`}
              >
                <VideoCameraIcon className="h-4 w-4" />
                {camBusy ? "…" : camOpened ? "Camera on" : "Camera"}
              </button>

              <button
                type="button"
                onClick={toggleCameraVideo}
                disabled={!camOpened || recording}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-semibold disabled:opacity-35"
                title="Stop sending webcam picture — microphone keeps working"
              >
                <VideoCameraSlashIcon className="h-4 w-4" />
                {cameraVideoOn ? "Video off (keep mic)" : "Video on"}
              </button>

              <button
                type="button"
                onClick={startScreenShare}
                disabled={sharingBusy || recording}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold disabled:opacity-50"
              >
                <ComputerDesktopIcon className="h-4 w-4" />
                {sharingBusy ? "…" : "Share screen"}
              </button>

              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-bold"
                >
                  <PlayCircleIcon className="h-5 w-5" />
                  Start recording
                </button>
              ) : (
                <>
                  {recorderSupportsPause() && (
                    <button
                      type="button"
                      onClick={togglePause}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-sm font-bold"
                    >
                      <PauseIcon className="h-5 w-5" />
                      {paused ? "Resume" : "Pause"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-bold"
                  >
                    <StopCircleIcon className="h-5 w-5" />
                    Stop recording
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-3 text-[10px] text-white/45">
              <span>Mic {micActive ? "●" : "○"}</span>
              <span>Screen {screenActive ? "●" : "○"}</span>
              <span>Camera {camOpened ? (cameraVideoOn ? "●" : "still (video off)") : "○"}</span>
              {recording && (
                <span className={`font-semibold ${paused ? "text-amber-300" : "text-red-400 animate-pulse"}`}>
                  {paused ? "Paused" : "Recording…"}
                </span>
              )}
            </div>
          </div>
        </footer>
      </div>,
      document.body,
    );

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      {studioPortal}

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back
      </button>

      <header className="mb-8">
        <div className="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{topicRow.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Library topic <span className="font-mono text-xs">{String(topicRow.id).slice(0, 8)}…</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasDeck && presentAbs ? (
              <a
                href={presentAbs}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black"
              >
                <PlayCircleIcon className="h-5 w-5" />
                Present (new tab)
              </a>
            ) : null}
            <button
              type="button"
              onClick={openSlideStudio}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50"
            >
              <PencilSquareIcon className="h-5 w-5" />
              Slide studio
            </button>
            {hasDeck && (
              <button
                type="button"
                onClick={() => {
                  setSlideIndex(0);
                  setStudioOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 shadow-sm"
              >
                <FilmIcon className="h-5 w-5" />
                Open record studio
              </button>
            )}
          </div>
        </div>
      </header>

      {!hasDeck && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-8">
          This topic has no slides yet. Use <strong>Slide studio</strong> to build a deck and save it to this topic.
        </div>
      )}

      {hasDeck && (
        <section className="mb-10">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Slides</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {slides.map((slide, i) => (
              <SlideThumbnail
                key={slide.id || i}
                slide={slide}
                template={template}
                index={i}
                isSelected={i === slideIndex}
                onClick={() => setSlideIndex(i)}
              />
            ))}
          </div>
        </section>
      )}

      {recordedUrl && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Last recording</h2>
          <video src={recordedUrl} controls className="w-full max-w-3xl rounded-xl border border-gray-200 bg-black" />
          <a
            href={recordedUrl}
            download={`lecture-${String(topicRow.id).slice(0, 8)}.webm`}
            className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-indigo-600"
          >
            Download WebM
          </a>
        </section>
      )}
    </div>
  );
}
