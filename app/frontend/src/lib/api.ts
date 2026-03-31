import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import type {
  AuthenticatedAdmin,
  Contact,
  ContactListResponse,
  DashboardResponse,
  ExportPreviewResponse,
  ExportProfile,
  LogsResponse,
  PasskeyCredential,
  AppSettings,
  Source,
  SourceAddressbook,
  SourceCreatePayload,
  SyncJob,
} from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
export const AUTH_UNAUTHORIZED_EVENT = "yealink-auth-unauthorized";

export class ApiError extends Error {
  status: number;
  payload: string;

  constructor(status: number, payload: string) {
    super(payload || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.text();
    let message = payload || `HTTP ${response.status}`;
    try {
      const jsonPayload = JSON.parse(payload) as { detail?: string };
      if (jsonPayload.detail) {
        message = jsonPayload.detail;
      }
    } catch {}
    if (response.status === 401 && path !== "/api/auth/me" && typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getCurrentAdmin: () => request<AuthenticatedAdmin>("/api/auth/me"),
  login: (payload: { username: string; password: string }) =>
    request<AuthenticatedAdmin>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
  changePassword: (payload: { current_password: string; new_password: string }) =>
    request<AuthenticatedAdmin>("/api/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
  listPasskeys: () => request<PasskeyCredential[]>("/api/auth/passkeys"),
  getPasskeyRegistrationOptions: (payload: { label: string }) =>
    request<{ options: PublicKeyCredentialCreationOptionsJSON }>("/api/auth/passkeys/registration/options", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyPasskeyRegistration: (payload: { credential: RegistrationResponseJSON }) =>
    request<PasskeyCredential>("/api/auth/passkeys/registration/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getPasskeyAuthenticationOptions: () =>
    request<{ options: PublicKeyCredentialRequestOptionsJSON }>("/api/auth/passkeys/authentication/options", {
      method: "POST",
    }),
  verifyPasskeyAuthentication: (payload: { credential: AuthenticationResponseJSON }) =>
    request<AuthenticatedAdmin>("/api/auth/passkeys/authentication/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deletePasskey: (id: string) => request<{ message: string }>(`/api/auth/passkeys/${id}`, { method: "DELETE" }),
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
