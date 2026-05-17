import { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Rehydrate from secure storage on app launch ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const storedToken =
          await SecureStore.getItemAsync("smart_school_token");
        const storedUser = await SecureStore.getItemAsync("smart_school_user");
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // Corrupted storage — start fresh
        await SecureStore.deleteItemAsync("smart_school_token");
        await SecureStore.deleteItemAsync("smart_school_user");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });

    // Normalize user_id → id (mirrors web AuthContext)
    const normalizedUser = {
      ...data,
      id: data.user_id ?? data.id,
    };

    const jwtToken = data.token;

    await SecureStore.setItemAsync("smart_school_token", jwtToken);
    await SecureStore.setItemAsync(
      "smart_school_user",
      JSON.stringify(normalizedUser),
    );

    setToken(jwtToken);
    setUser(normalizedUser);

    return normalizedUser;
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      if (user?.id) {
        await api.post(`/auth/logout?user_id=${user.id}`);
      }
    } catch {
      // Best-effort — always clear local state
    } finally {
      await SecureStore.deleteItemAsync("smart_school_token");
      await SecureStore.deleteItemAsync("smart_school_user");
      setToken(null);
      setUser(null);
    }
  };

  // ── Update local user state (e.g. after profile edit) ───────────────────
  const updateUser = async (updates) => {
    const updated = { ...user, ...updates };
    await SecureStore.setItemAsync(
      "smart_school_user",
      JSON.stringify(updated),
    );
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
