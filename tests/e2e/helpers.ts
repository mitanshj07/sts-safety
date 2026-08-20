// tests/e2e/helpers.ts
import { expect, type Page } from "@playwright/test";

export async function dismissPermissionPrimer(page: Page): Promise<void> {
  const enable = page.getByRole("button", { name: /enable location/i });
  try {
    await enable.waitFor({ state: "visible", timeout: 2500 });
    await enable.click();
  } catch {
    // Already granted.
  }
}

export async function loginAsOfficer(page: Page): Promise<void> {
  await page.goto("/login?tab=officer");
  await page.getByRole("button", { name: /enter command centre/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

export async function loginAsTourist(page: Page): Promise<void> {
  await page.goto("/login?tab=tourist");
  await page.getByRole("button", { name: /enter as priya sharma/i }).click();
  await page.waitForURL(/\/home/, { timeout: 20_000 });
  await dismissPermissionPrimer(page);
}

export async function signupWithDigilocker(page: Page): Promise<void> {
  await page.goto("/login?tab=tourist");
  await page.getByTestId("digilocker-signup").click();
  await page.getByTestId("digilocker-allow").click();
  await page.waitForURL(/\/onboard/, { timeout: 20_000 });
}

export async function expectHealthy(page: Page): Promise<void> {
  const res = await page.request.get("/api/health");
  expect(res.ok(), "GET /api/health must succeed for e2e").toBeTruthy();
}
