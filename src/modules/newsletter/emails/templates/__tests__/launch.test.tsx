// @vitest-environment node
import { render } from "react-email";
import { describe, expect, it } from "vitest";
import LaunchEmail, { launchSubject } from "../launch";

const props = {
  baseUrl: "https://flesh.example",
  productName: "Remera Oversize",
  price: "$ 28.500",
  imageUrl: "https://cdn.example/remera.jpg",
  productUrl: "https://flesh.example/producto/remera-oversize",
};

describe("LaunchEmail", () => {
  it("links the product and shows its name and transfer price", async () => {
    const html = await render(<LaunchEmail {...props} />);

    expect(html).toContain(`href="${props.productUrl}"`);
    expect(html).toContain("Remera Oversize");
    expect(html).toContain("$ 28.500");
    expect(html).toContain("CON TRANSFERENCIA");
    expect(html).toContain(`src="${props.imageUrl}"`);
    expect(html).toContain("NUEVO DROP");
    expect(html).toContain("NO DUERMAS");
  });

  it("has no unsubscribe link because it is a one-off requested notice", async () => {
    const html = await render(<LaunchEmail {...props} />);

    expect(html).not.toContain("DARME DE BAJA");
    expect(html).toContain("INSTAGRAM");
  });

  // A product has no single variant here, so the block must not print an empty
  // line between the name and the price.
  it("renders no variant line", async () => {
    const html = await render(<LaunchEmail {...props} />);

    expect(html).not.toContain("undefined");
    expect(html).not.toMatch(/<p[^>]*>\s*<\/p>/);
  });

  it("states why the shopper got it, for this exact garment", async () => {
    const html = await render(<LaunchEmail {...props} />);

    expect(html).toContain("cuando salga Remera Oversize");
  });

  it("lays the garment on the gym floor backdrop served from the base URL", async () => {
    const html = await render(<LaunchEmail {...props} />);

    expect(html).toMatch(/background:[^>]*https:\/\/flesh\.example\/email\/gym-floor\.jpg/);
    expect(html).toContain(`src="${props.imageUrl}"`);
  });

  it("uses square corners only", async () => {
    expect(await render(<LaunchEmail {...props} />)).not.toMatch(/border-radius/i);
  });

  it("builds the subject from the product name", () => {
    expect(launchSubject("Remera Oversize")).toBe("Ya salió: Remera Oversize");
  });
});
