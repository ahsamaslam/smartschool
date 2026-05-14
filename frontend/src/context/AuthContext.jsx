import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../services/api";
import { clearAdminPreviewTeacher } from "../utils/adminPreviewTeacher";

const AuthContext = createContext(null);

const TOKEN_KEY = "smart_school_token";
const USER_KEY = "smart_school_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(USER_KEY));
      // Normalize: backend returns user_id, components expect id
      if (stored && stored.user_id && !stored.id) {
        return { ...stored, id: stored.user_id };
      }
      return stored;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(false);

  // Keep Axios default header in sync with token state
  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  }, [token]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });

      // Normalize: backend returns user_id, components expect id
      const normalizedUser = { ...data, id: data.user_id };

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));

      setToken(data.token);
      setUser(normalizedUser);

      return {
        success: true,
        role: data.role,
        mustChangePassword: Boolean(data.must_change_password),
      };
    } catch (err) {
      const message =
        err.response?.data?.detail || "Login failed. Check your credentials.";
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (user?.user_id) {
        await api.post("/auth/logout", null, {
          params: { user_id: user.user_id },
        });
      }
    } catch {
      // Silently ignore — local state is cleared regardless
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      clearAdminPreviewTeacher();
      setToken(null);
      setUser(null);
    }
  }, [user]);

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
