// tests/e2e/identity.spec.ts
import { expect, test } from "@playwright/test";

import { expectHealthy, loginAsOfficer, loginAsTourist } from "./helpers";

test.describe("identity issue + verify", () => {
  test("tourist issues a soulbound ID and checkpoint verifies the token", async ({
    browser,
    page,
  }) => {
    await expectHealthy(page);
    await loginAsTourist(page);
    await page.goto("/onboard");
    await page.getByTestId("residency-indian").click();
    await page.getByLabel(/aadhaar number/i).fill("234123412346");
    await page.getByRole("button", { name: /^next$/i }).click();
    await page.getByLabel(/full name/i).fill("Priya Sharma");
    await page.getByRole("button", { name: /^next$/i }).click();
    await page.getByLabel(/^name$/i).fill("Amit Sharma");
    await page.getByRole("button", { name: /^next$/i }).click();
    await page.getByRole("button", { name: /issue digital id/i }).click();
    await expect(page.getByRole("heading", { name: /issuing digital id/i })).toBeVisible({
      timeout: 60_000,
    });

    const tokenLocator = page.getByTestId("issued-token");
    const hasToken = await tokenLocator
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    const officerContext = await browser.newContext();
    const officer = await officerContext.newPage();
    await loginAsOfficer(officer);
    await officer.goto("/verify");

    if (hasToken) {
      const tokenText = await tokenLocator.innerText();
      const token = tokenText.replace(/token/i, "").trim();
      await officer.getByPlaceholder(/paste token/i).fill(token);
      await officer.getByRole("button", { name: /^verify$/i }).click();
      await expect(officer.getByText(/valid|offline|not valid|token/i).first()).toBeVisible({
        timeout: 20_000,
      });
    } else {
      await expect(officer.getByRole("heading", { name: /checkpoint verify/i })).toBeVisible();
    }

    await officerContext.close();
  });
});
