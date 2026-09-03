const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://sih-26099-prototype.onrender.com/api";

let token: string | null = localStorage.getItem("token");

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
};