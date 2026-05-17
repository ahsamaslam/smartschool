import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { navigationRef } from "../navigation/navigationRef";
import { API_URL } from "../config";

const API_BASE_URL = API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor: attach stored JWT ──────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync("smart_school_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: handle 401 ───────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync("smart_school_token");
      await SecureStore.deleteItemAsync("smart_school_user");
      // Reset navigation to Login screen
      if (navigationRef.current?.isReady()) {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      }
    }
    return Promise.reject(error);
  },
);

export default api;
