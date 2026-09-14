import { describe, expect, it } from "vitest";
import { createCheckoutRateGuard } from "./checkout.guard";
import { readBuyerProfileSummary } from "./buyer-profile.service";

const VALID_BUYER = { firstName: "Felipe", lastName: "Saracho", email: "felipe@example.com" };

function dependencies(overrides: Partial<{ readBuyer: () => Promise<unknown>; guard: ReturnType<typeof createCheckoutRateGuard> }> = {}) {
  return {
    readBuyer: overrides.readBuyer ?? (async () => VALID_BUYER),
    guard: overrides.guard ?? createCheckoutRateGuard(),
  };
}

describe("readBuyerProfileSummary", () => {
  it("returns the masked label and hasProfile:true for a valid stored buyer", async () => {
    await expect(readBuyerProfileSummary(dependencies())).resolves.toEqual({
      hasProfile: true,
      maskedLabel: "Comprar como F••• S•••",
    });
  });

  it("returns hasProfile:false and no label when nothing is stored", async () => {
    await expect(readBuyerProfileSummary(dependencies({ readBuyer: async () => null }))).resolves.toEqual({
      hasProfile: false,
      maskedLabel: null,
    });
  });

  it("fails closed on a tampered stored value — never trusts an unvalidated shape", async () => {
    await expect(
      readBuyerProfileSummary(dependencies({ readBuyer: async () => ({ firstName: "Felipe" }) })),
    ).resolves.toEqual({ hasProfile: false, maskedLabel: null });
  });

  it("fails closed (no profile) once its own guard refuses, rather than throwing", async () => {
    const guard = createCheckoutRateGuard({ limit: 0 });

    await expect(readBuyerProfileSummary(dependencies({ guard }))).resolves.toEqual({
      hasProfile: false,
      maskedLabel: null,
    });
  });

  it("never returns a raw name, surname, or email field on the response", async () => {
    const summary = await readBuyerProfileSummary(dependencies());

    expect(Object.keys(summary).sort()).toEqual(["hasProfile", "maskedLabel"]);
    expect(JSON.stringify(summary)).not.toContain("Felipe");
    expect(JSON.stringify(summary)).not.toContain("@");
  });

  it("exhausting its own guard does not touch a separately-created checkout guard", async () => {
    const ownGuard = createCheckoutRateGuard({ limit: 1 });
    const checkoutGuard = createCheckoutRateGuard({ limit: 1 });

    await readBuyerProfileSummary(dependencies({ guard: ownGuard }));
    await readBuyerProfileSummary(dependencies({ guard: ownGuard })); // exhausts ownGuard

    // The checkout guard is a fully independent instance — exhausting the
    // profile read's own guard must never be able to touch it (design D7).
    expect(checkoutGuard.consume()).toBe(true);
  });
});
