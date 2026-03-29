import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExportProfileForm } from "../features/exportProfiles/ExportProfileForm";


test("builds a profile rules payload", async () => {
  const user = userEvent.setup();
  const handleSubmit = vi.fn();

  render(<ExportProfileForm sourceIds={["source-1"]} onSubmit={handleSubmit} />);

  await user.type(screen.getByPlaceholderText("Default"), "Sales");
  await user.type(screen.getByPlaceholderText("default"), "sales");
  const expressionInput = screen.getByPlaceholderText("{organization} ?? {full_name} ?? primary_phone");
  await user.clear(expressionInput);
  await user.paste("{organization} - {full_name}");
  await user.click(screen.getByRole("button", { name: "Save profile" }));

  expect(handleSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Sales",
      slug: "sales",
      rule_set: expect.objectContaining({
        filters: expect.objectContaining({ include_source_ids: ["source-1"] }),
        name_template: expect.objectContaining({ expression: "{organization} - {full_name}" }),
      }),
    }),
  );
});
