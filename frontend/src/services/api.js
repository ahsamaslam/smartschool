import axios from "axios";

/**
 * Axios merges baseURL + url using URL resolution. Leading slashes on relative paths can
 * drop the `/api` segment (wrong final URL). We always end base with `/` and strip a
 * leading `/` from paths in the request interceptor.
 *
 * If VITE_API_URL is just `http://localhost:8000` (no path), FastAPI still lives under
 * `/api`, so we append `/api` when the URL path is `/`.
 */
function normalizeBackendApiBase(raw) {
  const fallback = "http://localhost:8000/api";
  const s = (raw ?? "").trim() || fallback;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `http://${s}`);
    let path = u.pathname.replace(/\/+$/, "") || "/";
    if (path === "/") {
      u.pathname = "/api";
    } else {
      u.pathname = path;
    }
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return "http://localhost:8000/api/";
  }
}

const baseURL = normalizeBackendApiBase(import.meta.env.VITE_API_URL ?? "");

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor — attach JWT ──────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    if (typeof config.url === "string" && config.url.startsWith("/") && !/^https?:\/\//i.test(config.url)) {
      config.url = config.url.slice(1);
    }
    const token = localStorage.getItem("smart_school_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor — handle 401 globally ────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale credentials and redirect to login
      localStorage.removeItem("smart_school_token");
      localStorage.removeItem("smart_school_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
