import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { ToastProvider } from "../hooks/useToast";
import { ContactsPage } from "../pages/ContactsPage";

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

test("contacts page requests paginated contacts and advances pages", async () => {
  const user = userEvent.setup();
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/api/contacts?") && method === "GET") {
      const parsed = new URL(url, "http://localhost");
      const offset = Number(parsed.searchParams.get("offset") ?? "0");
      const limit = Number(parsed.searchParams.get("limit") ?? "25");
      return jsonResponse({
        items: [
          {
            id: `contact-${offset}`,
            source_id: "source-1",
            source_contact_id: `remote-${offset}`,
            full_name: `Contact ${offset}`,
            groups: [],
            content_hash: `hash-${offset}`,
            phone_numbers: [],
            emails: [],
            addresses: [],
            duplicate_hints: [],
          },
        ],
        total: 30,
        offset,
        limit,
      });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  });

  renderWithProviders(<ContactsPage />);

  expect(await screen.findByText("Showing 1 of 30 contact(s)")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Next page" }));

  expect(await screen.findByText("Contact 25")).toBeInTheDocument();
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining("/api/contacts?offset=25&limit=25"),
    expect.anything(),
  );
});
