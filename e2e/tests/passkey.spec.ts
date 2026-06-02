import { expect, test } from "@playwright/test";

import { enableVirtualAuthenticator } from "../helpers/webauthn";

const ADMIN_USERNAME = "admin";
const BOOTSTRAP_PASSWORD = "admin";
const ADMIN_PASSWORD = "E2eTestPass1!";

test.describe("Passkey authentication", () => {
  test.beforeEach(async ({ context, page }) => {
    await enableVirtualAuthenticator(context, page);
  });

  test("registers a passkey after bootstrap login and signs in with it", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sign in to Yealink Contacts Sync" })).toBeVisible();

    await page.getByLabel("Username").fill(ADMIN_USERNAME);
    await page.getByLabel("Password").fill(BOOTSTRAP_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    const passwordChangeHeading = page.getByRole("heading", { name: "Change the bootstrap password" });
    const dashboardHeading = page.getByRole("heading", { name: "Synchronization status" });
    await expect(passwordChangeHeading.or(dashboardHeading)).toBeVisible();

    if (await passwordChangeHeading.isVisible()) {
      await page.getByLabel("Current password").fill(BOOTSTRAP_PASSWORD);
      await page.getByLabel("New password", { exact: true }).fill(ADMIN_PASSWORD);
      await page.getByLabel("Confirm new password").fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(dashboardHeading).toBeVisible();
    }

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Application settings" })).toBeVisible();

    const passkeyLabel = "E2E Playwright device";
    await page.getByPlaceholder("Office MacBook").fill(passkeyLabel);
    const registerPasskey = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/passkeys/registration/verify") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add passkey" }).click();
    const verifyResponse = await registerPasskey;
    expect(verifyResponse.ok(), await verifyResponse.text()).toBeTruthy();

    await expect(page.getByText(passkeyLabel)).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in to Yealink Contacts Sync" })).toBeVisible();

    const authVerify = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/passkeys/authentication/verify") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Sign in with passkey" }).click();
    const authResponse = await authVerify;
    expect(authResponse.ok(), await authResponse.text()).toBeTruthy();

    // Sign-out from Settings leaves the URL on /settings; passkey login restores the session there.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Synchronization status" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(".auth-sidebar-card strong")).toHaveText(ADMIN_USERNAME);
  });

  test("registers a second passkey when one already exists", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Username").fill(ADMIN_USERNAME);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Synchronization status" })).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();

    const secondLabel = "E2E second passkey";
    await page.getByPlaceholder("Office MacBook").fill(secondLabel);
    const registerPasskey = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/passkeys/registration/verify") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add passkey" }).click();
    const verifyResponse = await registerPasskey;
    expect(verifyResponse.ok(), await verifyResponse.text()).toBeTruthy();
    await expect(page.getByText(secondLabel)).toBeVisible({ timeout: 5_000 });
  });
});
