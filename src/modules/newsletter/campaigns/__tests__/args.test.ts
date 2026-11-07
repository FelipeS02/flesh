import { describe, expect, it } from "vitest";
import { CampaignUsageError, parseCampaignArgs } from "../args";

describe("parseCampaignArgs", () => {
  it("defaults to a dry run", () => {
    expect(parseCampaignArgs(["example-drop"])).toEqual({ slug: "example-drop", mode: "dry-run", fromBatch: 0 });
  });

  it("selects the real send with --send", () => {
    expect(parseCampaignArgs(["example-drop", "--send"])).toMatchObject({ mode: "send" });
  });

  it("accepts flags before the slug", () => {
    expect(parseCampaignArgs(["--send", "example-drop"])).toMatchObject({ slug: "example-drop", mode: "send" });
  });

  it.each([
    [["drop", "--to", "me@example.com"]],
    [["drop", "--to=me@example.com"]],
  ])("reads the test recipient from %j", (argv) => {
    expect(parseCampaignArgs(argv)).toEqual({ slug: "drop", mode: "test", to: "me@example.com", fromBatch: 0 });
  });

  // A test send must never fan out to the list, whatever else was typed.
  it("lets --to win over --send", () => {
    expect(parseCampaignArgs(["drop", "--send", "--to", "me@example.com"])).toMatchObject({ mode: "test" });
  });

  it("resumes from a batch index with --send", () => {
    expect(parseCampaignArgs(["drop", "--send", "--from-batch", "7"])).toMatchObject({ mode: "send", fromBatch: 7 });
    expect(parseCampaignArgs(["drop", "--send", "--from-batch=0"])).toMatchObject({ fromBatch: 0 });
  });

  it.each([
    [[], /slug/i],
    [["a", "b"], /one campaign/i],
    // The slug becomes a file path, so anything that could leave the folder is refused.
    [["../secrets"], /slug/i],
    [["Example"], /slug/i],
    [["drop", "--unknown"], /--unknown/],
    [["drop", "--to"], /--to/],
    [["drop", "--to", "not-an-email"], /email/i],
    [["drop", "--send", "--from-batch", "-1"], /--from-batch/],
    [["drop", "--send", "--from-batch", "x"], /--from-batch/],
    [["drop", "--send", "--from-batch"], /--from-batch/],
    [["drop", "--from-batch", "2"], /only .* --send/i],
  ])("rejects %j", (argv, message) => {
    expect(() => parseCampaignArgs(argv)).toThrow(CampaignUsageError);
    expect(() => parseCampaignArgs(argv)).toThrow(message);
  });
});
