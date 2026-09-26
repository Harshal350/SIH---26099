// Vite statically replaces import.meta.env at build time. The `|| {}` keeps the
// module importable outside a Vite context (e.g. the verification harness),
// where import.meta.env does not exist.
const env = (import.meta as any).env || {};
const API_BASE = env.VITE_API_BASE_URL || "https://sih-26099-prototype.onrender.com/api";

let token: string | null = typeof localStorage === "undefined" ? null : localStorage.getItem("token");

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

export function getToken() {
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; username: string; displayName: string; role: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ username, password }) }
    ),
  health: () => request<{ status: string }>("/health"),
  dashboard: () => request<any>("/dashboard"),
  materials: () => request<any[]>("/materials"),
  material: (id: number) => request<any>(`/materials/${id}`),
  organizations: () => request<string[]>("/materials/organizations"),
  master: () => request<any[]>("/master"),
  masterSources: (id: number) => request<any[]>(`/master/${id}/sources`),
  pendingMatches: () => request<any[]>("/matching/pending"),
  runMatching: () => request<any>("/matching/run", { method: "POST" }),
  approveMatch: (id: number, note?: string) =>
    request<any>(`/matching/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note: note || "" }),
    }),
  rejectMatch: (id: number, note?: string) =>
    request<void>(`/matching/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note: note || "" }),
    }),
  escalateMatch: (id: number, note?: string) =>
    request<void>(`/matching/${id}/escalate`, {
      method: "POST",
      body: JSON.stringify({ note: note || "" }),
    }),
  dqSummary: () => request<any>("/data-quality/summary"),
  dqIssues: () => request<any[]>("/data-quality"),
  audit: () => request<any[]>("/audit"),
  users: () => request<any[]>("/users"),
  procurement: () => request<any>("/procurement"),
  uploadFile: (jobId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_BASE}/import/${jobId}/upload`, { method: "POST", body: fd, headers }).then(
      (r) => r.json()
    );
  },
  createImportJob: (meta: Record<string, string>) =>
    request<any>("/import/create", { method: "POST", body: JSON.stringify(meta) }),
  syncLiveRepository: async (source: string, limit = 10, query = "") => {
    // Attempt live fetch endpoint
    try {
      const res = await fetch("/api/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, limit, query }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      /* continue */
    }

    try {
      const res = await fetch(`${API_BASE}/repos/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ source, limit, query }),
      });
      if (res.ok) return await res.json();
    } catch {
      /* continue */
    }

    throw new Error(`Unable to fetch live records from ${source}. Please check connectivity.`);
  },
};