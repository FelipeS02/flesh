// @vitest-environment node
import { render } from "react-email";
import { describe, expect, it } from "vitest";
import { CampaignUsageError } from "../args";
import { buildTemplateTestMessage, parseTemplateTestArgs } from "../template-test";

describe("parseTemplateTestArgs", () => {
  it("reads the template and the recipient", () => {
    expect(parseTemplateTestArgs(["launch", "--to", "me@example.com"])).toEqual({
      template: "launch",
      to: "me@example.com",
    });
    expect(parseTemplateTestArgs(["--to=me@example.com", "restock"])).toMatchObject({ template: "restock" });
  });

  it("takes an origin override", () => {
    expect(
      parseTemplateTestArgs(["restock", "--to", "me@example.com", "--origin", "https://dev.flesh.ar"]),
    ).toMatchObject({ origin: "https://dev.flesh.ar" });
  });

  it.each([
    [[], /Missing template/],
    [["welcome", "--to", "me@example.com"], /Unknown template "welcome"/],
    [["launch"], /--to/],
    [["launch", "--to", "not-an-email"], /valid email/],
    [["launch", "--to", "me@example.com", "--origin", "dev.flesh.ar"], /absolute http\(s\) URL/],
    [["launch", "--to", "me@example.com", "--send"], /Unknown option --send/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseTemplateTestArgs(argv)).toThrow(CampaignUsageError);
    expect(() => parseTemplateTestArgs(argv)).toThrow(message);
  });
});

describe("buildTemplateTestMessage", () => {
  it("marks the subject as a test so it is never mistaken for a real notice", () => {
    const message = buildTemplateTestMessage("restock", "https://dev.flesh.ar", "me@example.com");

    expect(message.to).toBe("me@example.com");
    expect(message.subject).toMatch(/^\[TEST\] Volvió tu talle: /);
  });

  // The whole point is seeing the email in a real client: Gmail fetches every
  // image through its proxy, so localhost assets would arrive broken.
  it("refuses an origin a mail client cannot reach", () => {
    expect(() => buildTemplateTestMessage("launch", "http://localhost:3000", "me@example.com")).toThrow(
      CampaignUsageError,
    );
  });

  it.each(["launch", "restock"] as const)("builds every %s URL from the origin", async (template) => {
    const message = buildTemplateTestMessage(template, "https://dev.flesh.ar", "me@example.com");
    const html = await render(message.react);

    expect(html).toContain("https://dev.flesh.ar/email/gym-floor.jpg");
    expect(html).toContain("https://dev.flesh.ar/email/logotype.png");
    expect(html).toMatch(/href="https:\/\/dev\.flesh\.ar\/producto\/[a-z0-9-]+"/);
    expect(html).not.toContain("localhost");
  });
});
