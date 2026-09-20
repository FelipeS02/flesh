import { describe, expect, it } from "vitest";
import { buildUserData } from "../user-data";

// Pinned vectors, computed once with node:crypto. They exist so a change to
// the normalisation rules — or to the digest itself — fails loudly instead of
// quietly sending Meta hashes it can never match against its own.
const HASHED = {
  email: "05ccd2e7bbcd7afb381f0729b03830803fb2b15ff41c25066591cb4a1b54e1a4",
  firstName: "2bd2d3a31934d76198acc030caca4c31965474fe5fa48f35fef79d0fd74ee1b2",
  lastName: "9c089a194a26a6c7e2687e0dafac90c070209517f6c35ba52f53d82d1d4a84bc",
} as const;

const buyer = {
  firstName: "Felipe",
  lastName: "Saracho",
  email: "test@flesh.com.ar",
};

describe("buildUserData", () => {
  it("hashes the buyer with the vectors Meta will match against", () => {
    expect(buildUserData({ buyer })).toEqual({
      em: [HASHED.email],
      fn: [HASHED.firstName],
      ln: [HASHED.lastName],
    });
  });

  // Meta normalises before hashing on their side too, so a stray space or a
  // capital letter is the difference between a matched conversion and a
  // wasted one.
  it("normalises case and surrounding space before hashing", () => {
    expect(
      buildUserData({
        buyer: {
          firstName: "  FELIPE ",
          lastName: "Saracho  ",
          email: " Test@Flesh.Com.Ar ",
        },
      }),
    ).toEqual({
      em: [HASHED.email],
      fn: [HASHED.firstName],
      ln: [HASHED.lastName],
    });
  });

  it("passes the identifiers Meta expects unhashed", () => {
    const userData = buildUserData({
      buyer,
      fbc: "fb.2.1726700000000.IwAR1abc",
      fbp: "fb.1.1726700000000.123456789",
      clientIpAddress: "190.1.2.3",
      clientUserAgent: "Mozilla/5.0",
    });

    expect(userData).toMatchObject({
      fbc: "fb.2.1726700000000.IwAR1abc",
      fbp: "fb.1.1726700000000.123456789",
      client_ip_address: "190.1.2.3",
      client_user_agent: "Mozilla/5.0",
    });
  });

  // An absent identifier must be absent, not present and empty: Meta counts a
  // blank field against match quality rather than ignoring it.
  it("omits identifiers it was not given", () => {
    const userData = buildUserData({ buyer });

    expect(userData).not.toHaveProperty("fbc");
    expect(userData).not.toHaveProperty("fbp");
    expect(userData).not.toHaveProperty("client_ip_address");
    expect(userData).not.toHaveProperty("client_user_agent");
  });

  /**
   * The guarantee the whole module exists for. Asserted over the serialised
   * payload rather than field by field, so a future field carrying a raw name
   * fails here even though nobody thought to write a test for it.
   */
  it("never lets a raw personal value into the payload", () => {
    const serialised = JSON.stringify(
      buildUserData({
        buyer,
        fbc: "fb.2.1.x",
        clientIpAddress: "190.1.2.3",
        clientUserAgent: "Mozilla/5.0",
      }),
    ).toLowerCase();

    for (const raw of ["felipe", "saracho", "test@flesh.com.ar", "flesh.com"]) {
      expect(serialised).not.toContain(raw);
    }
  });
});
