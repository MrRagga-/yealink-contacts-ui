import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { ToastProvider } from "../hooks/useToast";
import { ExportsPage } from "../pages/ExportsPage";
import { SourcesPage } from "../pages/SourcesPage";

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
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

test("sources page shows failed sync feedback with error styling", async () => {
  const user = userEvent.setup();

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/sources") && method === "GET") {
      return jsonResponse([
        {
          id: "source-1",
          name: "Directory",
          slug: "directory",
          type: "carddav",
          is_active: true,
          notes: "",
          tags: [],
          last_successful_sync_at: null,
          last_error: null,
          addressbooks: [],
          credential_summary: { merge_strategy: "upsert_only" },
        },
      ]);
    }

    if (url.endsWith("/api/settings") && method === "GET") {
      return jsonResponse({
        app_version: "0.2.5",
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
        admin_allowed_cidrs: ["0.0.0.0/0"],
        xml_allowed_cidrs: ["0.0.0.0/0"],
      });
    }

    if (url.endsWith("/api/sources/source-1/sync") && method === "POST") {
      return new Response("Sync backend down.", { status: 500 });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  renderWithProviders(<SourcesPage />);

  await user.click(await screen.findByRole("button", { name: "Start sync" }));

  const failureFeedback = await screen.findByText("Sync failed: Sync backend down.");
  expect(failureFeedback).toHaveClass("error-box");
});

test("exports page keeps automatic preview copy neutral until a profile is explicitly chosen", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/export-profiles") && method === "GET") {
      return jsonResponse([
        {
          id: "profile-1",
          name: "Sales",
          slug: "sales",
          description: "",
          is_active: true,
          sort_order: 0,
          metadata: {},
          xml_url: "http://localhost:5173/api/yealink/phonebook/sales.xml",
          rule_set: {
            filters: {
              include_source_ids: ["source-1"],
              exclude_source_ids: [],
              include_groups: [],
              search_query: null,
              blacklist_contact_ids: [],
              blacklist_numbers: [],
              require_phone: true,
            },
            phone_selection: {
              allowed_types: ["mobile"],
              excluded_types: [],
              priority_order: ["mobile"],
              require_phone: true,
              max_numbers_per_contact: 1,
              normalize_to_e164: true,
            },
            name_template: {
              expression: "{full_name}",
              prefix: "",
              suffix: "",
              normalize_whitespace: true,
            },
          },
        },
      ]);
    }

    if (url.includes("/api/exports/preview") && method === "GET") {
      return jsonResponse({
        profile_id: "profile-1",
        profile_slug: "sales",
        exported_total: 0,
        discarded_total: 0,
        preview_limit: 50,
        exported: [],
        discarded: [],
        generated_xml: null,
      });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  renderWithProviders(<ExportsPage />);

  expect(await screen.findByText("Select a specific profile above to pin a fixed XML URL for the phone.")).toBeInTheDocument();
  expect(
    await screen.findByText((content) => content.includes("Select a specific profile above before rolling out a fixed provisioning snippet.")),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      "The XML preview below reflects the backend's automatic/default profile selection. Choose a specific profile above to inspect a fixed profile export.",
    ),
  ).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Load generated XML" })).toBeInTheDocument();
  expect(screen.queryByText("Automatic profile selection")).not.toBeInTheDocument();
});
