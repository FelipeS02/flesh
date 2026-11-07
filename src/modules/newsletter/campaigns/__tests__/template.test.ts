import { describe, expect, it } from "vitest";
import { campaignFilePath, readCampaignTemplate } from "../template";

describe("readCampaignTemplate", () => {
  const Body = () => null;

  it("accepts a module with a component, a subject and a preview text", () => {
    const template = readCampaignTemplate("drop", { default: Body, subject: "Hola", previewText: "Vista previa" });

    expect(template).toEqual({ default: Body, subject: "Hola", previewText: "Vista previa" });
  });

  // tsx loads a .tsx file as CommonJS, so a dynamic import wraps the real
  // exports one level down: { default: { default, subject, previewText } }.
  it("unwraps a CommonJS-interop module", () => {
    const exports = { default: Body, subject: "Hola", previewText: "Vista previa" };

    expect(readCampaignTemplate("drop", { default: exports })).toEqual(exports);
  });

  it.each([
    [{ subject: "x", previewText: "y" }, /default/],
    [{ default: Body, previewText: "y" }, /subject/],
    [{ default: Body, subject: "  ", previewText: "y" }, /subject/],
    [{ default: Body, subject: "x" }, /previewText/],
  ])("names what a malformed campaign is missing", (module, missing) => {
    expect(() => readCampaignTemplate("drop", module)).toThrow(missing);
    expect(() => readCampaignTemplate("drop", module)).toThrow(/drop/);
  });
});

describe("campaignFilePath", () => {
  it("resolves inside the campaigns folder", () => {
    expect(campaignFilePath("example-drop")).toMatch(/emails[\\/]campaigns[\\/]example-drop\.tsx$/);
  });
});
