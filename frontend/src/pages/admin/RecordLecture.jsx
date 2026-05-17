import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams, useLocation, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FilmIcon,
  PlayCircleIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  MicrophoneIcon,
  PauseIcon,
  StopCircleIcon,
  ArrowPathIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import libraryService from "../../services/libraryService";
import teacherService from "../../services/teacherService";
import { SlideThumbnail } from "../../components/slides/SlideThumbnail";
import { SLIDE_TEMPLATES, SLIDE_ANIMATIONS } from "../../data/slideTemplates";
import { SlideRenderer } from "../../components/slides/SlideRenderer";
import { PageSpinner } from "../../components/common/Spinner";
import { parseLibraryTopicSlidesJson } from "../../utils/libraryTopicSlides";
import { normalizeLibraryTopicId, libraryTopicPresentAbsUrl } from "../../utils/libraryNavigation";

/** Best-effort media duration from file (preferred over timer for saved metadata). */
function probeBlobVideoDurationSeconds(blob) {
  return new Promise((resolve) => {
    if (!blob?.size) {
      resolve(0);
      return;
    }
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const url = URL.createObjectURL(blob);
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(0);
    }, 5000);
    v.onloadedmetadata = () => {
      window.clearTimeout(timeout);
      const d = Number(v.duration);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d !== Number.POSITIVE_INFINITY ? d : 0);
    };
    v.onerror = () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(0);
    };
    v.src = url;
  });
}

function pickRecorderMime() {
  const cand = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return cand.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
}

function recorderSupportsPause() {
  return typeof MediaRecorder !== "undefined" && typeof MediaRecorder.prototype.pause === "function";
}

/** FastAPI often returns `detail` as a string, object, or array of { msg, loc, … } — safe for toasts and JSX text. */
function formatFastApiDetail(detail, fallback = "") {
  if (detail == null || detail === "") return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && typeof item.msg === "string") return item.msg;
        if (item && typeof item === "object") {
          try {
            return JSON.stringify(item);
          } catch {
            return "";
          }
        }
        return String(item);
      })
      .filter(Boolean);
    return parts.length ? parts.join(" ") : fallback;
  }
  if (typeof detail === "object") {
    if (typeof detail.msg === "string") return detail.msg;
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }
  return String(detail);
}

/**
 * Recording = dedicated compositor canvas stream + microphone audio.
 * Final video includes only slide rendering + webcam + annotations + laser.
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
  const stageRef = useRef(null);
  const annotationCanvasRef = useRef(null);
  const compositeCanvasRef = useRef(null);
  const webcamCompositeVideoRef = useRef(null);
  const rafRef = useRef(null);
  const compositeStreamRef = useRef(null);

  const micStreamRef = useRef(null);
  const camStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordedMimeRef = useRef("video/webm");

  const [micActive, setMicActive] = useState(false);
  const [camOpened, setCamOpened] = useState(false);
  const [cameraVideoOn, setCameraVideoOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [camBusy, setCamBusy] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef(null);

  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [savingLecture, setSavingLecture] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [quality, setQuality] = useState("720p");
  const [deletingLecture, setDeletingLecture] = useState(false);
  const [webcamPos, setWebcamPos] = useState({ x: 76, y: 70 });
  const [webcamSize, setWebcamSize] = useState(190);
  const [webcamLocked, setWebcamLocked] = useState(false);
  const [webcamPip, setWebcamPip] = useState(true);
  const [draggingWebcam, setDraggingWebcam] = useState(false);
  const [tool, setTool] = useState("pointer");
  const [laserPoint, setLaserPoint] = useState(null);
  const drawingRef = useRef(false);
  const [slideTimestamps, setSlideTimestamps] = useState([]);

  const lectureMeta = (() => {
    const raw = topicRow?.lecture_metadata_json;
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return typeof raw === "object" ? raw : null;
  })();
  const hasSavedLecture = Boolean(topicRow?.lecture_video_url);
  const lectureUrl = topicRow?.lecture_video_url
    ? `${(import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace("/api", "")}${topicRow.lecture_video_url}`
    : "";

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
        const res = await teacherService.getMyTopicContent(topicKey);
        const rowRaw = res.data?.data ?? res.data;
        const row =
          rowRaw && typeof rowRaw === "object" && !Array.isArray(rowRaw)
            ? { ...rowRaw, id: rowRaw.library_topic_id || rowRaw.id }
            : null;
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
            formatFastApiDetail(detail) ||
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
    stopMic();
    stopCam();
  }, [stopMic, stopCam]);

  useEffect(() => () => stopAllMedia(), [stopAllMedia]);

  useEffect(() => {
    if (!recording) return undefined;
    const key = `lecture_draft_${topicKey}`;
    const persist = () => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            topicId: topicKey,
            slideIndex,
            elapsedSec,
            quality,
            slideTimestamps,
            updatedAt: Date.now(),
          }),
        );
      } catch {
        /* ignore */
      }
    };
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
      persist();
    };
    const timer = window.setInterval(persist, 5000);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearInterval(timer);
    };
  }, [recording, topicKey, slideIndex, elapsedSec, quality, slideTimestamps]);

  useEffect(() => {
    if (!topicKey) return;
    const key = `lecture_draft_${topicKey}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || !window.confirm("Restore previous unfinished lecture session settings?")) return;
      if (typeof draft.slideIndex === "number") setSlideIndex(Math.max(0, draft.slideIndex));
      if (typeof draft.quality === "string") setQuality(draft.quality);
      if (Array.isArray(draft.slideTimestamps)) setSlideTimestamps(draft.slideTimestamps);
      localStorage.removeItem(key);
      toast("Recovered previous session settings.", { duration: 2500 });
    } catch {
      /* ignore */
    }
  }, [topicKey]);

  useEffect(() => {
    if (!studioOpen || !topicRow?.title) return undefined;
    const prev = document.title;
    document.title = `Record: ${topicRow.title}`;
    return () => {
      document.title = prev;
    };
  }, [studioOpen, topicRow?.title]);

  useEffect(() => {
    if (!studioOpen) return undefined;
    const resize = () => {
      const stage = stageRef.current;
      const c = annotationCanvasRef.current;
      if (!stage || !c) return;
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nextW = Math.max(320, Math.floor(rect.width));
      const nextH = Math.max(180, Math.floor(rect.height));
      if (c.width !== nextW || c.height !== nextH) {
        const prev = document.createElement("canvas");
        prev.width = c.width;
        prev.height = c.height;
        const prevCtx = prev.getContext("2d");
        prevCtx?.drawImage(c, 0, 0);
        c.width = nextW;
        c.height = nextH;
        c.getContext("2d")?.drawImage(prev, 0, 0, nextW, nextH);
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [studioOpen]);

  useEffect(() => {
    if (!recording || paused) return undefined;
    const timer = window.setInterval(() => {
      setElapsedSec((s) => Math.round((Number(s) + 0.25) * 1000) / 1000);
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording, paused]);

  const formatDuration = (sec) => {
    const total = Math.max(0, Math.floor(Number(sec || 0)));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const positionFromPointer = (clientX, clientY) => {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  const drawAt = (pt, erase = false) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || !pt) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (erase) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.save();
    if (tool === "highlighter") {
      ctx.strokeStyle = "rgba(251, 191, 36, 0.45)";
      ctx.lineWidth = 16;
    } else {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.restore();
  };

  const renderSlideToCanvas = (ctx, slide, theme, width, height) => {
    const css = theme?.css || {};
    const bg = css.slideBackground || "#111827";
    const title = String(slide?.title || "");
    const lines = (Array.isArray(slide?.content) ? slide.content : []).map((x) => String(x || ""));
    const layout = slide?.layout || "title-bullets";

    const wrapText = (text, maxWidth) => {
      const words = String(text || "").split(/\s+/).filter(Boolean);
      const out = [];
      let cur = "";
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(next).width <= maxWidth) {
          cur = next;
        } else {
          if (cur) out.push(cur);
          cur = w;
        }
      }
      if (cur) out.push(cur);
      return out.length ? out : [""];
    };

    const paintBackground = () => {
      if (typeof bg === "string" && bg.includes("gradient")) {
        const colors = bg.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g) || [];
        const grad = ctx.createLinearGradient(0, 0, width, height);
        if (colors.length >= 2) {
          colors.slice(0, 4).forEach((c, i, arr) => {
            grad.addColorStop(i / Math.max(1, arr.length - 1), c);
          });
        } else {
          grad.addColorStop(0, "#111827");
          grad.addColorStop(1, "#1f2937");
        }
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = typeof bg === "string" ? bg : "#111827";
      }
      ctx.fillRect(0, 0, width, height);
    };

    const drawTitle = (x, y, maxWidth, centered = false, sizeScale = 1) => {
      const titleSize = Math.max(30, Math.floor(width * 0.038 * sizeScale));
      ctx.fillStyle = css.titleColor || "#f9fafb";
      ctx.font = `${css.titleWeight || 700} ${titleSize}px ${css.titleFont || "Inter, Arial"}`;
      ctx.textAlign = centered ? "center" : "left";
      const wrapped = wrapText(title, maxWidth);
      let cy = y;
      wrapped.slice(0, 3).forEach((ln) => {
        ctx.fillText(ln, x, cy);
        cy += Math.floor(titleSize * 1.18);
      });
      return cy;
    };

    const drawBullets = (items, x, y, maxWidth, numbered = false) => {
      const bodySize = Math.max(17, Math.floor(width * 0.021));
      const bullet = css.bulletChar || "•";
      ctx.fillStyle = css.bodyColor || "#e5e7eb";
      ctx.font = `500 ${bodySize}px ${css.bodyFont || "Inter, Arial"}`;
      ctx.textAlign = "left";
      let cy = y;
      items.slice(0, 10).forEach((item, idx) => {
        const prefix = numbered ? `${idx + 1}. ` : `${bullet} `;
        const wrapped = wrapText(item, maxWidth - 30);
        wrapped.forEach((ln, i) => {
          ctx.fillText(i === 0 ? `${prefix}${ln}` : `   ${ln}`, x, cy);
          cy += Math.floor(bodySize * 1.45);
        });
        cy += 6;
      });
      return cy;
    };

    paintBackground();

    const accent = css.accentColor || "#818cf8";
    ctx.fillStyle = accent;
    ctx.fillRect(Math.floor(width * 0.08), Math.floor(height * 0.1), Math.floor(width * 0.09), 4);

    if (css.splitLeft) {
      const lw = Math.floor(width * 0.36);
      ctx.fillStyle = css.splitBg || accent;
      ctx.fillRect(0, 0, lw, height);
      drawTitle(Math.floor(lw * 0.1), Math.floor(height * 0.22), Math.floor(lw * 0.8), false, 0.9);
      drawBullets(lines, lw + Math.floor(width * 0.06), Math.floor(height * 0.24), Math.floor(width * 0.52), false);
      return;
    }

    if (layout === "title-only") {
      drawTitle(width / 2, Math.floor(height * 0.42), Math.floor(width * 0.74), true, 1.15);
      if (lines[0]) {
        ctx.fillStyle = css.bodyColor || "#e5e7eb";
        ctx.font = `500 ${Math.max(18, Math.floor(width * 0.02))}px ${css.bodyFont || "Inter, Arial"}`;
        ctx.textAlign = "center";
        ctx.fillText(lines[0], width / 2, Math.floor(height * 0.62));
      }
      return;
    }

    if (layout === "quote") {
      ctx.fillStyle = `${accent}99`;
      ctx.font = `${Math.max(90, Math.floor(width * 0.09))}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.fillText("“", width / 2, Math.floor(height * 0.26));
      ctx.fillStyle = css.bodyColor || "#e5e7eb";
      ctx.font = `500 ${Math.max(24, Math.floor(width * 0.027))}px ${css.bodyFont || "Inter, Arial"}`;
      const q = wrapText(lines[0] || "", Math.floor(width * 0.72));
      let y = Math.floor(height * 0.42);
      q.slice(0, 5).forEach((ln) => {
        ctx.fillText(ln, width / 2, y);
        y += Math.floor(width * 0.035);
      });
      if (title) {
        ctx.fillStyle = accent;
        ctx.font = `700 ${Math.max(16, Math.floor(width * 0.016))}px ${css.bodyFont || "Inter, Arial"}`;
        ctx.fillText(`— ${title}`, width / 2, y + 24);
      }
      return;
    }

    if (layout === "two-column") {
      drawTitle(Math.floor(width * 0.08), Math.floor(height * 0.18), Math.floor(width * 0.84), false, 1);
      const half = Math.ceil(lines.length / 2);
      drawBullets(lines.slice(0, half), Math.floor(width * 0.09), Math.floor(height * 0.32), Math.floor(width * 0.36), false);
      drawBullets(lines.slice(half), Math.floor(width * 0.56), Math.floor(height * 0.32), Math.floor(width * 0.36), false);
      return;
    }

    if (layout === "highlight") {
      drawTitle(Math.floor(width * 0.08), Math.floor(height * 0.2), Math.floor(width * 0.84), false, 1);
      const boxX = Math.floor(width * 0.08);
      const boxY = Math.floor(height * 0.34);
      const boxW = Math.floor(width * 0.84);
      const boxH = Math.floor(height * 0.4);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = `${accent}cc`;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      drawBullets([lines[0] || ""], boxX + 24, boxY + 56, boxW - 48, false);
      return;
    }

    if (layout === "steps") {
      drawTitle(Math.floor(width * 0.08), Math.floor(height * 0.18), Math.floor(width * 0.84), false, 1);
      drawBullets(lines, Math.floor(width * 0.1), Math.floor(height * 0.3), Math.floor(width * 0.8), true);
      return;
    }

    drawTitle(Math.floor(width * 0.08), Math.floor(height * 0.18), Math.floor(width * 0.84), false, 1);
    drawBullets(lines, Math.floor(width * 0.1), Math.floor(height * 0.3), Math.floor(width * 0.82), false);
  };

  const beginStroke = (e) => {
    if (!annotationCanvasRef.current) return;
    if (!["pen", "highlighter", "eraser"].includes(tool)) return;
    const p = positionFromPointer(e.clientX, e.clientY);
    if (!p) return;
    const canvas = annotationCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
    drawAt({ x, y }, tool === "eraser");
  };

  const moveStroke = (e) => {
    const stagePoint = positionFromPointer(e.clientX, e.clientY);
    if (tool === "laser") {
      setLaserPoint(stagePoint);
    }
    if (!drawingRef.current) return;
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    drawAt({ x, y }, tool === "eraser");
  };

  const endStroke = () => {
    drawingRef.current = false;
  };

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

  const toggleMic = async () => {
    if (!micStreamRef.current) {
      await startMic();
      return;
    }
    const tracks = micStreamRef.current.getAudioTracks?.() || [];
    if (!tracks.length) {
      setMicActive(false);
      return;
    }
    const next = !tracks[0].enabled;
    tracks.forEach((t) => {
      t.enabled = next;
    });
    setMicActive(next);
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

  const stopComposite = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    compositeStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    compositeStreamRef.current = null;
  }, []);

  useEffect(() => () => stopComposite(), [stopComposite]);

  const startCompositeLoop = useCallback((qualityKey) => {
    const qualityMap = {
      "360p": { width: 640, height: 360, bitrate: 900_000, frameRate: 24 },
      "480p": { width: 854, height: 480, bitrate: 1_400_000, frameRate: 24 },
      "720p": { width: 1280, height: 720, bitrate: 2_500_000, frameRate: 30 },
      "1080p": { width: 1920, height: 1080, bitrate: 4_500_000, frameRate: 30 },
    };
    const q = qualityMap[qualityKey] || qualityMap["720p"];
    const canvas = compositeCanvasRef.current;
    if (!canvas) return { stream: null, bitrate: q.bitrate };
    canvas.width = q.width;
    canvas.height = q.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { stream: null, bitrate: q.bitrate };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderSlideToCanvas(ctx, currentSlide, template, canvas.width, canvas.height);
      const anno = annotationCanvasRef.current;
      if (anno) {
        ctx.drawImage(anno, 0, 0, canvas.width, canvas.height);
      }
      if (camOpened && cameraVideoOn && webcamCompositeVideoRef.current?.readyState >= 2) {
        const w = clamp(Math.floor((webcamSize / 1000) * canvas.width), 110, Math.floor(canvas.width * 0.45));
        const h = w;
        const x = clamp(Math.floor((webcamPos.x / 100) * canvas.width), 8, canvas.width - w - 8);
        const y = clamp(Math.floor((webcamPos.y / 100) * canvas.height), 8, canvas.height - h - 8);
        ctx.save();
        if (webcamPip) {
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
        }
        ctx.drawImage(webcamCompositeVideoRef.current, x, y, w, h);
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = Math.max(3, Math.floor(w * 0.03));
        if (webcamPip) {
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeRect(x, y, w, h);
        }
      }
      if (laserPoint?.x != null && laserPoint?.y != null) {
        const lx = (laserPoint.x / 100) * canvas.width;
        const ly = (laserPoint.y / 100) * canvas.height;
        const grad = ctx.createRadialGradient(lx, ly, 2, lx, ly, 24);
        grad.addColorStop(0, "rgba(239,68,68,0.95)");
        grad.addColorStop(1, "rgba(239,68,68,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, 24, 0, Math.PI * 2);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    const stream = canvas.captureStream(q.frameRate);
    compositeStreamRef.current = stream;
    return { stream, bitrate: q.bitrate };
  }, [camOpened, cameraVideoOn, webcamPos.x, webcamPos.y, webcamSize, webcamPip, laserPoint?.x, laserPoint?.y, currentSlide, template]);

  const startRecording = () => {
    const mic = micStreamRef.current;
    chunksRef.current = [];
    setRecordedBlob(null);
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (webcamCompositeVideoRef.current && camStreamRef.current) {
      webcamCompositeVideoRef.current.srcObject = camStreamRef.current;
      webcamCompositeVideoRef.current.muted = true;
      void webcamCompositeVideoRef.current.play().catch(() => {});
    }
    const composed = startCompositeLoop(quality);
    const out = new MediaStream();
    composed.stream?.getVideoTracks()?.forEach((t) => out.addTrack(t));
    mic?.getAudioTracks()?.forEach((t) => out.addTrack(t));
    if (!out.getVideoTracks().length) {
      toast.error("Could not initialize composite video.");
      return;
    }
    const bitrate = composed.bitrate;

    const mimePreferred = pickRecorderMime();
    let mr;
    try {
      mr = new MediaRecorder(out, { mimeType: mimePreferred, videoBitsPerSecond: bitrate });
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
        setRecordedBlob(blob);
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
      setElapsedSec(0);
      setSlideTimestamps([{ slide: slideIndex + 1, time: 0 }]);
      setSaveError("");
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
    stopComposite();
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
    stopComposite();
    stopAllMedia();
    setStudioOpen(false);
    setPaused(false);
    setTool("pointer");
    setLaserPoint(null);
    const anno = annotationCanvasRef.current;
    if (anno) {
      anno.getContext("2d")?.clearRect(0, 0, anno.width, anno.height);
    }
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

  const togglePresentationFullscreen = () => {
    const target = stageRef.current;
    if (!target) return;
    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const saveLectureToTopic = async () => {
    if (!topicRow?.id) return;
    if (!recordedBlob) {
      setSaveError("No recording available to save.");
      return;
    }
    setSavingLecture(true);
    setSaveError("");
    try {
      const fromMarks = Array.isArray(slideTimestamps)
        ? slideTimestamps.reduce((m, x) => Math.max(m, Number(x?.time) || 0), 0)
        : 0;
      const fromBlob = await probeBlobVideoDurationSeconds(recordedBlob);
      const tick = Number(elapsedSec);
      const blobN = Number(fromBlob);
      const rawMax = Math.max(
        Number.isFinite(tick) ? tick : 0,
        Number.isFinite(fromMarks) ? fromMarks : 0,
        Number.isFinite(blobN) ? blobN : 0,
      );
      const durationCombined = Number.isFinite(rawMax) ? rawMax : 0;
      const fd = new FormData();
      fd.append("video", recordedBlob, `lecture-${topicRow.id}.webm`);
      fd.append("quality", quality);
      fd.append("duration_seconds", String(durationCombined));
      fd.append("has_camera", String(camOpened && cameraVideoOn));
      fd.append("has_microphone", String(micActive));
      fd.append("slide_timestamps_json", JSON.stringify(slideTimestamps || []));
      fd.append("transcript", "");
      fd.append("captions_json", JSON.stringify([]));
      const res = await teacherService.uploadMyTopicLecture(topicRow.id, fd);
      const row = res?.data?.data ?? res?.data;
      if (row?.id) setTopicRow((prev) => ({ ...prev, ...row, id: row.library_topic_id || row.id }));
      toast.success("Lecture saved. It will appear on Recorded Lectures once you refresh that page.");
    } catch (e) {
      const msg = formatFastApiDetail(e?.response?.data?.detail, "Failed to save lecture.");
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSavingLecture(false);
    }
  };

  const deleteLecture = async () => {
    if (!topicRow?.id) return;
    if (!window.confirm("Delete recorded lecture for this topic?")) return;
    setDeletingLecture(true);
    try {
      const res = await teacherService.deleteMyTopicLecture(topicRow.id);
      const row = res?.data?.data ?? res?.data;
      if (row?.id) setTopicRow((prev) => ({ ...prev, ...row, id: row.library_topic_id || row.id }));
      toast.success("Lecture deleted.");
    } catch (e) {
      toast.error(formatFastApiDetail(e?.response?.data?.detail, "Failed to delete lecture."));
    } finally {
      setDeletingLecture(false);
    }
  };

  const goPrevSlide = useCallback(() => setSlideIndex((i) => Math.max(0, i - 1)), []);
  const goNextSlide = useCallback(
    () => setSlideIndex((i) => Math.min(slides.length - 1, i + 1)),
    [slides.length],
  );

  useEffect(() => {
    if (!recording) return;
    setSlideTimestamps((prev) => {
      const marker = { slide: slideIndex + 1, time: elapsedSec };
      if (prev.length && prev[prev.length - 1].slide === marker.slide) return prev;
      return [...prev, marker];
    });
  }, [slideIndex, recording, elapsedSec]);

  useEffect(() => {
    if (!studioOpen || !hasDeck) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.code === "Space") goNextSlide();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrevSlide();
      if (e.key.toLowerCase() === "m") void toggleMic();
      if (e.key.toLowerCase() === "c") {
        if (!camOpened) {
          void startCamera();
        } else {
          toggleCameraVideo();
        }
      }
      if (e.key.toLowerCase() === "p" && recording && recorderSupportsPause()) togglePause();
      if (e.key.toLowerCase() === "s" && recording) stopRecording();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studioOpen, hasDeck, goNextSlide, goPrevSlide, camOpened, recording]);

  useEffect(() => {
    if (!draggingWebcam) return undefined;
    const onMove = (e) => {
      const p = positionFromPointer(e.clientX, e.clientY);
      if (!p) return;
      setWebcamPos(p);
    };
    const onUp = () => setDraggingWebcam(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingWebcam]);

  useEffect(() => {
    if (!studioOpen) return undefined;
    const showTemporarily = () => {
      setControlsVisible(true);
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = setTimeout(() => setControlsVisible(false), 2200);
    };
    showTemporarily();
    window.addEventListener("mousemove", showTemporarily);
    return () => {
      window.removeEventListener("mousemove", showTemporarily);
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, [studioOpen]);

  if (loading) {
    return (
      <div className="p-6">
        <PageSpinner />
      </div>
    );
  }

  if (!topicKey) {
    return <Navigate to="/admin/recorded-lectures" replace />;
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePresentationFullscreen}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold"
            >
              {document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen"}
            </button>
            <button
              type="button"
              onClick={closeStudio}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold"
            >
              Exit studio
            </button>
          </div>
        </header>

        <div className="flex-1 relative flex items-center justify-center p-4 min-h-0 overflow-hidden bg-neutral-950">
          <div
            ref={stageRef}
            className={`relative w-full max-w-5xl rounded-xl shadow-2xl ring-1 ring-white/10 bg-black overflow-hidden ${motionClass}`}
            style={{ aspectRatio: "16/9" }}
          >
            {currentSlide && (
              <SlideRenderer slide={currentSlide} template={template} slideIndex={slideIndex} />
            )}

            <div
              className={`absolute z-30 ${webcamLocked ? "pointer-events-none" : "cursor-move"}`}
              style={{
                left: `${webcamPos.x}%`,
                top: `${webcamPos.y}%`,
                width: webcamSize,
                height: webcamSize,
                transform: "translate(-50%, -50%)",
              }}
              onMouseDown={(e) => {
                if (webcamLocked) return;
                e.preventDefault();
                setDraggingWebcam(true);
              }}
            >
              <div
                className={`relative w-full h-full ${webcamPip ? "rounded-full" : "rounded-xl"} overflow-hidden shadow-2xl ring-[5px] ring-white/95 bg-neutral-900 ${
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
            <canvas
              ref={annotationCanvasRef}
              className={`absolute inset-0 z-20 ${
                ["pen", "highlighter", "eraser", "laser"].includes(tool) ? "pointer-events-auto" : "pointer-events-none"
              }`}
              onMouseDown={beginStroke}
              onMouseMove={moveStroke}
              onMouseUp={endStroke}
              onMouseLeave={() => {
                endStroke();
                if (tool === "laser") setLaserPoint(null);
              }}
            />
          </div>
        </div>

        <footer
          className={`absolute bottom-0 left-0 right-0 z-40 border-t border-white/15 bg-black/85 px-4 py-3 transition-opacity ${
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="max-w-5xl mx-auto flex flex-col gap-3">
            <p className="text-[11px] text-amber-200/95 text-center sm:text-left leading-relaxed">
              <strong>Flow:</strong> Mic/camera optional → Start recording. Final video includes only slide content, webcam,
              annotations, laser pointer, and microphone audio.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={goPrevSlide}
                disabled={slideIndex === 0}
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
                disabled={slideIndex >= slides.length - 1}
                className="px-3 py-2 rounded-xl bg-white/10 text-sm disabled:opacity-35"
              >
                Next →
              </button>
              <span className="w-px h-6 bg-white/15 hidden sm:block mx-1" />

              <button
                type="button"
                onClick={() => void toggleMic()}
                disabled={micBusy}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 ${
                  micActive ? "bg-emerald-800 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                <MicrophoneIcon className="h-4 w-4" />
                {micBusy ? "…" : micActive ? "Mic on" : "Mic off"}
              </button>

              <button
                type="button"
                onClick={startCamera}
                disabled={camBusy}
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
                disabled={!camOpened}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-semibold disabled:opacity-35"
                title="Stop sending webcam picture — microphone keeps working"
              >
                <VideoCameraSlashIcon className="h-4 w-4" />
                {cameraVideoOn ? "Video off (keep mic)" : "Video on"}
              </button>

              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                disabled={recording}
                className="px-3 py-2 rounded-xl bg-white/10 text-sm text-white border border-white/20 disabled:opacity-40"
                title="Recording quality"
              >
                <option value="360p">360p</option>
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>

              <div className="flex items-center gap-1 rounded-xl bg-white/10 px-2 py-1">
                {["pointer", "pen", "highlighter", "eraser", "laser"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setTool(k);
                      if (k !== "laser") setLaserPoint(null);
                    }}
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      tool === k ? "bg-white text-gray-900" : "text-white/80 hover:bg-white/15"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const c = annotationCanvasRef.current;
                  if (!c) return;
                  c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold"
              >
                Clear ink
              </button>

              <div className="flex items-center gap-1 rounded-xl bg-white/10 px-2 py-1">
                <button type="button" onClick={() => setWebcamPos({ x: 85, y: 82 })} className="px-2 py-1 text-xs rounded hover:bg-white/15">BR</button>
                <button type="button" onClick={() => setWebcamPos({ x: 15, y: 82 })} className="px-2 py-1 text-xs rounded hover:bg-white/15">BL</button>
                <button type="button" onClick={() => setWebcamPos({ x: 15, y: 18 })} className="px-2 py-1 text-xs rounded hover:bg-white/15">TL</button>
                <button type="button" onClick={() => setWebcamPos({ x: 85, y: 18 })} className="px-2 py-1 text-xs rounded hover:bg-white/15">TR</button>
              </div>

              <input
                type="range"
                min={120}
                max={320}
                value={webcamSize}
                onChange={(e) => setWebcamSize(Number(e.target.value))}
                className="w-24 accent-rose-500"
                title="Webcam size"
              />
              <button
                type="button"
                onClick={() => setWebcamLocked((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold"
              >
                {webcamLocked ? "Unlock cam" : "Lock cam"}
              </button>
              <button
                type="button"
                onClick={() => setWebcamPip((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold"
              >
                {webcamPip ? "PiP mode" : "Square cam"}
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
              <span>Camera {camOpened ? (cameraVideoOn ? "●" : "still (video off)") : "○"}</span>
              <span>{formatDuration(elapsedSec)}</span>
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
      <canvas ref={compositeCanvasRef} className="hidden" />
      <video ref={webcamCompositeVideoRef} className="hidden" playsInline muted />

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
            {hasSavedLecture && lectureUrl && (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/topics/${topicRow.id}/lecture`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-50"
                >
                  Open recorded lecture
                </button>
                <button
                  type="button"
                  onClick={deleteLecture}
                  disabled={deletingLecture}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingLecture ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
                  Delete lecture
                </button>
              </>
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
          <h2 className="text-lg font-bold text-gray-900 mb-3">Preview lecture</h2>
          <video src={recordedUrl} controls className="w-full max-w-3xl rounded-xl border border-gray-200 bg-black" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveLectureToTopic}
              disabled={savingLecture}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingLecture ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
              Save Lecture
            </button>
            <button
              type="button"
              onClick={() => {
                setRecordedBlob(null);
                setRecordedUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
            >
              Re-record
            </button>
            <a
              href={recordedUrl}
              download={`lecture-${String(topicRow.id).slice(0, 8)}.webm`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50"
            >
              Download Backup
            </a>
          </div>
          {saveError && (
            <div className="mt-3 text-sm text-red-600">
              {saveError}{" "}
              <button type="button" onClick={saveLectureToTopic} className="font-semibold underline">
                Retry
              </button>
            </div>
          )}
        </section>
      )}

      {hasSavedLecture && lectureUrl && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm mt-6">
          <h2 className="text-lg font-bold text-emerald-900 mb-2">Saved lecture</h2>
          <p className="text-sm text-emerald-800 mb-3">
            Duration: {formatDuration(lectureMeta?.duration)} · Quality: {lectureMeta?.quality || "720p"}
          </p>
          <video src={lectureUrl} controls className="w-full max-w-3xl rounded-xl border border-emerald-200 bg-black" />
        </section>
      )}
    </div>
  );
}
