import type {
  Contact,
  ContactListResponse,
  DashboardResponse,
  ExportPreviewResponse,
  ExportProfile,
  LogsResponse,
  AppSettings,
  Source,
  SourceAddressbook,
  SourceCreatePayload,
  SyncJob,
} from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getDashboard: () => request<DashboardResponse>("/api/dashboard"),
  getSources: () => request<Source[]>("/api/sources"),
  createSource: (payload: SourceCreatePayload) =>
    request<Source>("/api/sources", { method: "POST", body: JSON.stringify(payload) }),
  updateSource: (id: string, payload: Partial<SourceCreatePayload>) =>
    request<Source>(`/api/sources/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSource: (id: string) => request<{ message: string }>(`/api/sources/${id}`, { method: "DELETE" }),
  testSource: (id: string) => request<{ ok: boolean; message: string; capabilities: Record<string, unknown>; addressbooks: SourceAddressbook[] }>(`/api/sources/${id}/test`, { method: "POST" }),
  discoverAddressbooks: (id: string) => request<{ ok: boolean; addressbooks: SourceAddressbook[] }>(`/api/sources/${id}/discover-addressbooks`, { method: "POST" }),
  syncSource: (id: string) => request<SyncJob>(`/api/sources/${id}/sync`, { method: "POST" }),
  startGoogleOAuth: (id: string) => request<{ authorization_url: string }>(`/api/sources/${id}/oauth/google/start`, { method: "POST" }),
  getContacts: (query?: string, sourceId?: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sourceId) params.set("source_id", sourceId);
    return request<ContactListResponse>(`/api/contacts?${params.toString()}`);
  },
  getContact: (id: string) => request<Contact>(`/api/contacts/${id}`),
  deleteContact: (id: string) => request<{ message: string }>(`/api/contacts/${id}`, { method: "DELETE" }),
  getProfiles: () => request<ExportProfile[]>("/api/export-profiles"),
  createProfile: (payload: Record<string, unknown>) =>
    request<ExportProfile>("/api/export-profiles", { method: "POST", body: JSON.stringify(payload) }),
  updateProfile: (id: string, payload: Record<string, unknown>) =>
    request<ExportProfile>(`/api/export-profiles/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  previewProfile: (id: string) =>
    request<ExportPreviewResponse>(`/api/export-profiles/${id}/preview`, { method: "POST" }),
  getPreview: (profileId?: string) =>
    request<ExportPreviewResponse>(`/api/exports/preview${profileId ? `?profile_id=${profileId}` : ""}`),
  getJobs: () => request<SyncJob[]>("/api/jobs"),
  getLogs: () => request<LogsResponse>("/api/logs"),
  getAppSettings: () => request<AppSettings>("/api/settings"),
  updateAppSettings: (payload: Partial<AppSettings>) =>
    request<AppSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(payload) }),
  exportConfig: () => request<Record<string, unknown>>("/api/config/export", { method: "POST" }),
  importConfig: (payload: Record<string, unknown>) =>
    request<Record<string, unknown>>("/api/config/import", { method: "POST", body: JSON.stringify(payload) }),
  apiBase: API_BASE,
};
