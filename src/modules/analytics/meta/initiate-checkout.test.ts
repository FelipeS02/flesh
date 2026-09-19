import { describe, expect, it } from "vitest";
import { toInitiateCheckoutEvent } from "./initiate-checkout";

const buyer = {
  firstName: "Felipe",
  lastName: "Saracho",
  email: "test@flesh.com.ar",
};

const lines = [
  { variantId: 101, quantity: 2, price: { amount: 4_500_000, currency: "ARS" } },
  { variantId: 202, quantity: 1, price: { amount: 2_000_000, currency: "ARS" } },
];

const base = {
  buyer,
  lines,
  nowMs: 1_726_700_000_000,
  sourceUrl: "https://flesh.com.ar/",
};

describe("toInitiateCheckoutEvent", () => {
  it("reports the cart Tiendanube is about to be handed", () => {
    const event = toInitiateCheckoutEvent(base);

    expect(event).toMatchObject({
      event_name: "InitiateCheckout",
      action_source: "website",
      event_source_url: "https://flesh.com.ar/",
      custom_data: {
        currency: "ARS",
        // 2 x 45000 + 1 x 20000, in major units.
        value: 110_000,
        content_type: "product",
        content_ids: ["101", "202"],
        contents: [
          { id: "101", quantity: 2, item_price: 45_000 },
          { id: "202", quantity: 1, item_price: 20_000 },
        ],
      },
    });
  });

  // Meta reads event_time in seconds. Sending milliseconds puts the event tens
  // of thousands of years into the future, where it is silently discarded.
  it("stamps the event in seconds, not milliseconds", () => {
    expect(toInitiateCheckoutEvent(base).event_time).toBe(1_726_700_000);
  });

  it("carries the click id and pixel cookie when the visit had them", () => {
    const event = toInitiateCheckoutEvent({
      ...base,
      fbc: "fb.2.1726700000000.IwAR1abc",
      fbp: "fb.1.1726700000000.123456789",
      clientIpAddress: "190.1.2.3",
      clientUserAgent: "Mozilla/5.0",
    });

    expect(event.user_data).toMatchObject({
      fbc: "fb.2.1726700000000.IwAR1abc",
      fbp: "fb.1.1726700000000.123456789",
      client_ip_address: "190.1.2.3",
      client_user_agent: "Mozilla/5.0",
    });
  });

  /**
   * This event exists because it is the one place holding both the ad click
   * and the buyer's identity. It must still never carry either in the clear.
   */
  it("never serialises a raw personal value", () => {
    const serialised = JSON.stringify(
      toInitiateCheckoutEvent({ ...base, fbc: "fb.2.1.x" }),
    ).toLowerCase();

    for (const raw of ["felipe", "saracho", "test@flesh.com.ar"]) {
      expect(serialised).not.toContain(raw);
    }
  });

  it("refuses to price a cart that mixes currencies", () => {
    expect(() =>
      toInitiateCheckoutEvent({
        ...base,
        lines: [
          lines[0]!,
          { variantId: 303, quantity: 1, price: { amount: 100, currency: "USD" } },
        ],
      }),
    ).toThrow(/currenc/i);
  });
});
