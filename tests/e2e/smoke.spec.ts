import { expect, test } from "@playwright/test";

test.describe("lightweight smoke flows", () => {
  test("landing page loads and links into auth", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", {
        name: /turn campaign responses into boardroom-ready insights\./i,
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: /admin login/i }).click();
    await expect(page).toHaveURL(/\/auth$/);
    await expect(
      page.getByRole("heading", { name: /welcome/i }),
    ).toBeVisible();
  });

  test("auth page shows sign in and sign up states", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("button", { name: /sign in/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/email or username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    await page.getByRole("tab", { name: /sign up/i }).click();
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeVisible();
  });

  test("admin campaigns redirects unauthenticated users to auth", async ({ page }) => {
    await page.goto("/admin/campaigns", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/auth$/);
    await expect(
      page.getByText(/sign in to access the admin dashboard/i),
    ).toBeVisible();
  });
});
