import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/access-gate/api/access-guard", () => ({
  isAccessGranted: vi.fn(),
}));

vi.mock("../buyer-profile.service", () => ({
  readBuyerProfileSummary: vi.fn(async () => ({ hasProfile: true, maskedLabel: "a***@example.com" })),
}));

import { isAccessGranted } from "@/modules/access-gate/api/access-guard";
import { readBuyerProfileSummary } from "../buyer-profile.service";
import { readBuyerProfile } from "../buyer-profile.action";

describe("readBuyerProfile (action)", () => {
  it("returns the neutral empty summary and never calls the service when the gate is not granted", async () => {
    vi.mocked(isAccessGranted).mockResolvedValue(false);

    await expect(readBuyerProfile()).resolves.toEqual({ hasProfile: false, maskedLabel: null });
    expect(readBuyerProfileSummary).not.toHaveBeenCalled();
  });

  it("delegates to the service when the gate is granted", async () => {
    vi.mocked(isAccessGranted).mockResolvedValue(true);

    await expect(readBuyerProfile()).resolves.toEqual({ hasProfile: true, maskedLabel: "a***@example.com" });
  });
});
