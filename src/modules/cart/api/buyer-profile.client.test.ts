import { describe, expect, it } from "vitest";
import { createBuyerProfilePort } from "./buyer-profile.client";

describe("createBuyerProfilePort", () => {
  it("returns the injected action's result unchanged", async () => {
    const summary = { hasProfile: true, maskedLabel: "F••• S•••" };
    const port = createBuyerProfilePort(async () => summary);

    await expect(port.readSummary()).resolves.toEqual(summary);
  });

  it("passes through the absent-profile result unchanged", async () => {
    const summary = { hasProfile: false, maskedLabel: null };
    const port = createBuyerProfilePort(async () => summary);

    await expect(port.readSummary()).resolves.toEqual(summary);
  });
});
