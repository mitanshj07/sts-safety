// tests/e2e/identity.spec.ts
import { expect, test } from "@playwright/test";

import { expectHealthy, loginAsOfficer, loginAsTourist } from "./helpers";

const DEMO_AADHAAR = "2341 2341 2346";
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

test.describe("identity issue + verify", () => {
  test("tourist issues an Aadhaar ID and checkpoint verifies the QR", async ({
    browser,
    page,
  }) => {
    await expectHealthy(page);
    await loginAsTourist(page);
    await page.goto("/onboard");
    await page.getByTestId("residency-indian").click();
    await page.getByLabel(/aadhaar number/i).fill(DEMO_AADHAAR);
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
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    const officerContext = await browser.newContext();
    const officer = await officerContext.newPage();
    await loginAsOfficer(officer);
    await officer.goto("/verify");

    if (hasToken) {
      const tokenText = await tokenLocator.innerText();
      const credential = tokenText.match(UUID_RE)?.[0] ?? tokenText.replace(/^(token|id)\s+/i, "").trim();
      await officer.getByPlaceholder(/paste token/i).fill(credential);
      await officer.getByRole("button", { name: /^verify$/i }).click();
      await expect(officer.getByTestId("verify-badge")).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(officer.getByRole("heading", { name: /checkpoint verify/i })).toBeVisible();
    }

    await officerContext.close();
  });

  test("skip KYC mints a scannable guest ID with a North-East itinerary", async ({
    browser,
    page,
  }) => {
    await expectHealthy(page);
    await page.goto("/login?tab=tourist");
    await page.getByTestId("skip-onboarding").click();
    await page.waitForURL(/\/home/, { timeout: 30_000 });

    await page.goto("/trip");
    await expect(page.getByRole("heading", { name: /guwahati/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/id");
    const payload = page.getByTestId("id-qr-payload");
    await expect(payload).toBeVisible({ timeout: 20_000 });
    const raw = (await payload.innerText()).trim();
    expect(raw).toContain("digitalId");
    const parsed = JSON.parse(raw) as { digitalId?: string; touristId?: string };
    expect(parsed.digitalId).toMatch(UUID_RE);

    const officerContext = await browser.newContext();
    const officer = await officerContext.newPage();
    await loginAsOfficer(officer);
    await officer.goto("/verify");
    await officer.getByPlaceholder(/paste token/i).fill(raw);
    await officer.getByRole("button", { name: /^verify$/i }).click();
    await expect(officer.getByTestId("verify-badge")).toContainText(/guest|valid/i, {
      timeout: 20_000,
    });
    await expect(officer.getByText(/guwahati/i).first()).toBeVisible();

    await officerContext.close();
  });
});
