// @vitest-environment node
import { render } from "react-email";
import { describe, expect, it } from "vitest";
import ExampleDrop, { previewText, subject } from "../example-drop";

const props = {
  baseUrl: "https://flesh.example",
  unsubscribeUrl: "https://flesh.example/newsletter/baja?token=abc",
};

describe("example-drop campaign", () => {
  it("exports the subject and preview text the sender needs", () => {
    expect(subject).toBeTruthy();
    expect(previewText).toBeTruthy();
  });

  it("carries the drop copy and the call to action", async () => {
    const html = await render(<ExampleDrop {...props} />);

    expect(html).toContain("NUEVO DROP");
    expect(html).toContain("Stronger than death");
    expect(html).toContain("Dos remeras, una tirada corta.");
    expect(html).toContain("Ver el drop");
    expect(html).toContain("CON TRANSFERENCIA");
  });

  it("links the recipient own unsubscribe URL from the footer", async () => {
    const html = await render(<ExampleDrop {...props} />);

    expect(html).toContain(`href="${props.unsubscribeUrl}"`);
    expect(html).toContain("DARME DE BAJA");
  });

  it("builds image and CTA URLs from the base URL", async () => {
    const html = await render(<ExampleDrop {...props} />);

    expect(html).toContain("https://flesh.example/products/");
    expect(html).toContain('href="https://flesh.example"');
  });

  it("ships preview props so the dev server can render it", () => {
    expect(ExampleDrop.PreviewProps).toMatchObject({ baseUrl: expect.any(String), unsubscribeUrl: expect.any(String) });
  });
});
