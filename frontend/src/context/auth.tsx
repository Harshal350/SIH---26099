import { createContext, useContext, useState, ReactNode } from "react";
import { api, setToken } from "@/lib/api";

interface AuthState {
  user: { username: string; displayName: string; role: string } | null;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(() => {
    const t = localStorage.getItem("token");
    if (t) {
      try {
        const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        return {
          username: payload.sub,
          displayName: payload.sub,
          role: payload.role,
        };
      } catch {
        return null;
      }
    }
    return null;
  });

  async function login(username: string, password: string) {
    const res = await api.login(username, password);
    setToken(res.token);
    setUser({ username: res.username, displayName: res.displayName || res.username, role: res.role });
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
