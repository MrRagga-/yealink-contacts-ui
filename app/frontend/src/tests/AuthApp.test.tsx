import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { App } from "../App";
import { AuthProvider } from "../features/auth/AuthProvider";
import { ToastProvider } from "../hooks/useToast";
import { I18nProvider } from "../lib/i18n";
import { SettingsPage } from "../pages/SettingsPage";

function ensureLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
}

function renderWithProviders(children: ReactNode) {
  ensureLocalStorage();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("app signs in and transitions into the dashboard", async () => {
  let meCount = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/auth/me") && method === "GET") {
      meCount += 1;
      if (meCount === 1) {
        return jsonResponse({ detail: "Authentication required." }, 401);
      }
      return jsonResponse({
        id: "admin-1",
        username: "admin",
        must_change_password: false,
        is_active: true,
        passkey_count: 0,
      });
    }

    if (url.endsWith("/api/auth/login") && method === "POST") {
      return jsonResponse({
        id: "admin-1",
        username: "admin",
        must_change_password: false,
        is_active: true,
        passkey_count: 0,
      });
    }

    if (url.endsWith("/api/dashboard") && method === "GET") {
      return jsonResponse({
        source_count: 1,
        active_source_count: 1,
        export_profile_count: 1,
        contact_count: 10,
        exported_contact_count: 10,
        last_sync: null,
        xml_endpoints: [],
        recent_errors: [],
      });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  renderWithProviders(<App />);

  expect(await screen.findByRole("heading", { name: "Sign in to Yealink Contacts Sync" })).toBeInTheDocument();

  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Username"));
  await user.type(screen.getByLabelText("Username"), "admin");
  await user.clear(screen.getByLabelText("Password"));
  await user.type(screen.getByLabelText("Password"), "admin");
  await user.click(screen.getByRole("button", { name: "Sign in" }));

  expect(await screen.findByRole("heading", { name: "Synchronization status" })).toBeInTheDocument();
});

test("app blocks the main UI until the password has been changed", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/auth/me") && method === "GET") {
      return jsonResponse({
        id: "admin-1",
        username: "admin",
        must_change_password: true,
        is_active: true,
        passkey_count: 0,
      });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  renderWithProviders(<App />);

  expect(await screen.findByRole("heading", { name: "Change the bootstrap password" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Synchronization status" })).not.toBeInTheDocument();
});

test("app signs out and returns to the login screen", async () => {
  let meCount = 0;
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/auth/me") && method === "GET") {
      meCount += 1;
      if (meCount === 1) {
        return jsonResponse({
          id: "admin-1",
          username: "admin",
          must_change_password: false,
          is_active: true,
          passkey_count: 0,
        });
      }
      return jsonResponse({ detail: "Authentication required." }, 401);
    }

    if (url.endsWith("/api/auth/logout") && method === "POST") {
      return jsonResponse({ message: "Signed out." });
    }

    if (url.endsWith("/api/dashboard") && method === "GET") {
      return jsonResponse({
        source_count: 1,
        active_source_count: 1,
        export_profile_count: 1,
        contact_count: 10,
        exported_contact_count: 10,
        last_sync: null,
        xml_endpoints: [],
        recent_errors: [],
      });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  renderWithProviders(<App />);

  expect(await screen.findByRole("heading", { name: "Synchronization status" })).toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Sign out" }));

  expect(await screen.findByRole("heading", { name: "Sign in to Yealink Contacts Sync" })).toBeInTheDocument();
  await waitFor(() => {
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/logout"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

test("settings page renders the security section and registered passkeys", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/auth/me") && method === "GET") {
      return jsonResponse({
        id: "admin-1",
        username: "admin",
        must_change_password: false,
        is_active: true,
        passkey_count: 1,
      });
    }

    if (url.endsWith("/api/settings") && method === "GET") {
      return jsonResponse({
        app_version: "0.2.3",
        release_model: "Semantic Versioning via Git tags",
        default_new_source_type: "carddav",
        default_new_source_merge_strategy: "upsert_only",
        default_profile_allowed_types: ["mobile"],
        default_profile_excluded_types: ["fax"],
        default_profile_priority_order: ["mobile"],
        default_profile_max_numbers_per_contact: 2,
        default_profile_name_expression: "{full_name}",
        default_profile_prefix: "",
        default_profile_suffix: "",
        debug_enabled: false,
        admin_allowed_cidrs: ["0.0.0.0/0", "::/0"],
        xml_allowed_cidrs: ["192.168.1.0/24"],
      });
    }

    if (url.endsWith("/api/auth/passkeys") && method === "GET") {
      return jsonResponse([
        {
          id: "pk-1",
          label: "Office MacBook",
          transports: ["internal"],
          created_at: "2026-03-31T11:00:00Z",
          updated_at: "2026-03-31T11:00:00Z",
          last_used_at: "2026-03-31T12:00:00Z",
        },
      ]);
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  renderWithProviders(<SettingsPage />);

  expect(await screen.findByRole("heading", { name: "Security" })).toBeInTheDocument();
  expect(await screen.findByText("Office MacBook")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Office MacBook")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /Enable debug logging/i })).not.toBeChecked();
});
