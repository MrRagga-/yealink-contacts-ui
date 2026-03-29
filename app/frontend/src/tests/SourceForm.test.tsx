import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SourceForm } from "../features/sources/SourceForm";


test("submits a carddav source payload", async () => {
  const user = userEvent.setup();
  const handleSubmit = vi.fn();

  render(<SourceForm submitLabel="Save" onSubmit={handleSubmit} />);

  await user.type(screen.getByPlaceholderText("Company CardDAV"), "CardDAV Demo");
  await user.type(screen.getByPlaceholderText("company-carddav"), "carddav-demo");
  await user.type(screen.getByPlaceholderText("https://cloud.example.com/remote.php/dav/addressbooks/users/demo/"), "https://dav.example.com");
  await user.type(screen.getByPlaceholderText("jonas"), "demo");
  await user.type(screen.getByLabelText(/Password/i), "secret");
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(handleSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "CardDAV Demo",
      slug: "carddav-demo",
      type: "carddav",
      credential: expect.objectContaining({
        server_url: "https://dav.example.com",
        username: "demo",
        password: "secret",
      }),
    }),
  );
});
