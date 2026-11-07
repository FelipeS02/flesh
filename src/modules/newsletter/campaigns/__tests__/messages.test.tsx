// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BATCH_INTERVAL_MS,
  buildCampaignMessage,
  planCampaign,
  rebatch,
  unsubscribeLinks,
  type CampaignTemplate,
} from "../messages";

const ORIGIN = "https://flesh.test";
const ID = "7b1d6f0e-2c1a-4a58-9d3e-5a1f0c2b9e11";

function Body() {
  return null;
}
const template: CampaignTemplate = { default: Body, subject: "Nuevo drop", previewText: "Dos remeras" };

describe("unsubscribeLinks", () => {
  it("points the page link and the one-click header at the same token", () => {
    expect(unsubscribeLinks(ORIGIN, ID)).toEqual({
      unsubscribeUrl: `${ORIGIN}/newsletter/baja?token=${ID}`,
      headers: {
        "List-Unsubscribe": `<${ORIGIN}/api/newsletter/unsubscribe?token=${ID}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  });

  it("encodes the token so it cannot break out of the query string", () => {
    expect(unsubscribeLinks(ORIGIN, "a&b=c").unsubscribeUrl).toBe(`${ORIGIN}/newsletter/baja?token=a%26b%3Dc`);
  });
});

describe("buildCampaignMessage", () => {
  it("gives each recipient their own unsubscribe link", () => {
    const message = buildCampaignMessage(template, ORIGIN, { id: ID, email: "ana@example.com" });

    expect(message.to).toBe("ana@example.com");
    expect(message.subject).toBe("Nuevo drop");
    expect(message.react.props).toEqual({ baseUrl: ORIGIN, unsubscribeUrl: `${ORIGIN}/newsletter/baja?token=${ID}` });
    expect(message.headers?.["List-Unsubscribe"]).toContain(ID);
    expect(message.react.type).toBe(Body);
  });
});

describe("planCampaign", () => {
  it("counts batches of 100 and prices the wait at two batches per second", () => {
    expect(BATCH_INTERVAL_MS).toBe(500);
    expect(planCampaign(250, 0)).toEqual({ batchCount: 3, remainingBatches: 3, estimatedSeconds: 1.5 });
    expect(planCampaign(100, 0)).toMatchObject({ batchCount: 1 });
    expect(planCampaign(101, 0)).toMatchObject({ batchCount: 2 });
  });

  it("plans nothing for an empty list", () => {
    expect(planCampaign(0, 0)).toEqual({ batchCount: 0, remainingBatches: 0, estimatedSeconds: 0 });
  });

  it("counts only what is left when resuming", () => {
    expect(planCampaign(1000, 7)).toEqual({ batchCount: 10, remainingBatches: 3, estimatedSeconds: 1.5 });
    expect(planCampaign(1000, 99)).toMatchObject({ remainingBatches: 0 });
  });
});

describe("rebatch", () => {
  async function* pages<T>(...items: T[][]) {
    for (const page of items) yield page;
  }
  const collect = async <T,>(source: AsyncIterable<T[]>) => {
    const out: T[][] = [];
    for await (const batch of source) out.push(batch);
    return out;
  };

  it("re-cuts pages into fixed batches, keeping the remainder for the end", async () => {
    expect(await collect(rebatch(pages([1, 2, 3], [4, 5], [6, 7, 8]), 3))).toEqual([[1, 2, 3], [4, 5, 6], [7, 8]]);
  });

  it("yields nothing for no pages", async () => {
    expect(await collect(rebatch(pages(), 3))).toEqual([]);
  });
});
