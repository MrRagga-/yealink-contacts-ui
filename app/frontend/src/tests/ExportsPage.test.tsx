import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { ToastProvider } from "../hooks/useToast";
import { ExportsPage } from "../pages/ExportsPage";

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

test("exports page requests lightweight preview first and loads XML on demand", async () => {
  const user = userEvent.setup();
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
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
        {
          id: "profile-2",
          name: "Support",
          slug: "support",
          description: "",
          is_active: true,
          sort_order: 1,
          metadata: {},
          xml_url: "http://localhost:5173/api/yealink/phonebook/support.xml",
          rule_set: {
            filters: {
              include_source_ids: ["source-2"],
              exclude_source_ids: [],
              include_groups: [],
              search_query: null,
              blacklist_contact_ids: [],
              blacklist_numbers: [],
              require_phone: true,
            },
            phone_selection: {
              allowed_types: ["work"],
              excluded_types: [],
              priority_order: ["work"],
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
      const parsed = new URL(url, "http://localhost");
      const includeXml = parsed.searchParams.get("include_xml");
      return jsonResponse({
        profile_id: "profile-1",
        profile_slug: "sales",
        exported_total: 75,
        discarded_total: 4,
        preview_limit: 50,
        exported: [
          {
            contact_id: "contact-1",
            source_id: "source-1",
            source_name: "Sales",
            original_name: "Ada Lovelace",
            display_name: "Ada Lovelace",
            selected_numbers: [{ value: "+4930123", normalized_e164: "+4930123", type: "work" }],
            explanation: {
              included: true,
              display_name: "Ada Lovelace",
              reasons: ["Selected 1 number(s) for export."],
              discarded_numbers: [],
            },
            duplicate_hints: [],
          },
        ],
        discarded: [
          {
            contact_id: "contact-2",
            source_id: "source-1",
            source_name: "Sales",
            original_name: "Grace Hopper",
            display_name: null,
            selected_numbers: [],
            explanation: {
              included: false,
              display_name: null,
              reasons: ["No exportable phone number found."],
              discarded_numbers: [],
            },
            duplicate_hints: [],
          },
        ],
        generated_xml: includeXml === "true" ? "<YealinkIPPhoneBook />" : null,
      });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  renderWithProviders(<ExportsPage />);

  expect(await screen.findByText("Showing the first 1 exported contacts out of 75.")).toBeInTheDocument();
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining("preview_limit=50"),
    expect.anything(),
  );
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining("include_xml=false"),
    expect.anything(),
  );

  await user.click(screen.getByRole("button", { name: "Load generated XML" }));

  expect(await screen.findByDisplayValue("<YealinkIPPhoneBook />")).toBeInTheDocument();
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining("include_xml=true"),
    expect.anything(),
  );

  await user.selectOptions(screen.getByRole("combobox"), "profile-2");

  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining("profile_id=profile-2"),
    expect.anything(),
  );
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining("include_xml=false"),
    expect.anything(),
  );
});
