// tests/e2e/geofence.spec.ts
import { expect, test } from "@playwright/test";

import { expectHealthy, loginAsOfficer, loginAsTourist } from "./helpers";

test.describe("geofence breach end to end", () => {
  test("a ping inside Kaziranga core raises a restricted-entry incident", async ({
    browser,
  }) => {
    const touristContext = await browser.newContext({
      geolocation: { latitude: 26.62, longitude: 93.4, accuracy: 12 },
      permissions: ["geolocation"],
    });
    const tourist = await touristContext.newPage();
    await expectHealthy(tourist);
    await loginAsTourist(tourist);
    await tourist.goto("/map");

    const officerContext = await browser.newContext();
    const officer = await officerContext.newPage();
    await loginAsOfficer(officer);
    await officer.goto("/dashboard");

    await expect(officer.getByText(/geofence entry restricted/i).first()).toBeVisible({
      timeout: 25_000,
    });
    await expect(officer.getByText(/kaziranga/i).first()).toBeVisible();
    await expect(officer.getByLabel(/severity critical|severity high/i).first()).toBeVisible();

    await touristContext.close();
    await officerContext.close();
  });
});
