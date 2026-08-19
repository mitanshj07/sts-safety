// tests/e2e/sos.spec.ts
import { expect, test } from "@playwright/test";

import { expectHealthy, loginAsOfficer, loginAsTourist } from "./helpers";

test.describe("SOS end to end", () => {
  test("hold-to-confirm SOS opens a critical incident on the dashboard", async ({
    browser,
  }) => {
    const touristContext = await browser.newContext({
      geolocation: { latitude: 26.1445, longitude: 91.7362, accuracy: 10 },
      permissions: ["geolocation"],
    });
    const tourist = await touristContext.newPage();
    await expectHealthy(tourist);
    await loginAsTourist(tourist);
    await tourist.goto("/sos");

    const panic = tourist.getByRole("button", { name: /hold for 1\.5 seconds/i });
    await panic.scrollIntoViewIfNeeded();
    const box = await panic.boundingBox();
    if (!box) throw new Error("panic button not visible");
    await tourist.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await tourist.mouse.down();
    await tourist.waitForTimeout(1700);
    await tourist.mouse.up();
    await expect(tourist.getByText(/sent|sms fallback/i)).toBeVisible({ timeout: 15_000 });

    const officerContext = await browser.newContext();
    const officer = await officerContext.newPage();
    await loginAsOfficer(officer);
    await officer.goto("/dashboard");
    await expect(officer.getByText(/\bsos\b/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(officer.getByLabel(/severity critical/i).first()).toBeVisible();

    await officer.getByRole("option").filter({ hasText: /\bsos\b/i }).first().click();
    await expect(officer.getByRole("button", { name: /send to tourist/i })).toBeVisible({
      timeout: 10_000,
    });
    await officer.getByRole("button", { name: /^sos received$/i }).click();
    await expect(officer.getByText(/sent to tourist/i)).toBeVisible({ timeout: 15_000 });

    await expect(tourist.getByText(/we received your sos/i)).toBeVisible({ timeout: 20_000 });
    await tourist.goto("/alerts");
    await expect(tourist.getByText(/we received your sos/i)).toBeVisible();

    await touristContext.close();
    await officerContext.close();
  });
});
