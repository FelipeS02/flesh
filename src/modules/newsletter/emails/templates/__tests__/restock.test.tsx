// @vitest-environment node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "react-email";
import { describe, expect, it } from "vitest";
import RestockEmail, { restockSubject } from "../restock";

const props = {
  baseUrl: "https://flesh.example",
  productName: "Remera Oversize",
  variantLabel: "Negro / M",
  price: "$ 28.500",
  imageUrl: "https://cdn.example/remera.jpg",
  productUrl: "https://flesh.example/productos/remera-oversize",
};

describe("RestockEmail", () => {
  it("links the product and names the variant", async () => {
    const html = await render(<RestockEmail {...props} />);

    expect(html).toContain(`href="${props.productUrl}"`);
    expect(html).toContain("Negro / M");
    expect(html).toContain("$ 28.500");
    expect(html).toContain("CON TRANSFERENCIA");
    expect(html).toContain(`src="${props.imageUrl}"`);
  });

  it("has no unsubscribe link because it is a one-off requested notice", async () => {
    const html = await render(<RestockEmail {...props} />);

    expect(html).not.toContain("DARME DE BAJA");
    expect(html).toContain("INSTAGRAM");
  });

  it("states why the shopper got it, for this exact garment", async () => {
    const html = await render(<RestockEmail {...props} />);

    expect(html).toContain("cuando vuelva Remera Oversize en Negro / M");
  });

  it("builds the logo from the given base URL", async () => {
    expect(await render(<RestockEmail {...props} />)).toContain(
      'src="https://flesh.example/email/logotype.png"',
    );
  });

  it("lays the garment on the gym floor backdrop served from the base URL", async () => {
    const html = await render(<RestockEmail {...props} />);

    // Shorthand on purpose: Gmail's apps drop a standalone background-size.
    expect(html).toMatch(/background:[^>]*https:\/\/flesh\.example\/email\/gym-floor\.jpg/);
    expect(html).toContain(`src="${props.imageUrl}"`);
  });

  it("ships the backdrop file the email points to", () => {
    expect(existsSync(resolve(process.cwd(), "public/email/gym-floor.jpg"))).toBe(true);
  });

  it("uses square corners only", async () => {
    expect(await render(<RestockEmail {...props} />)).not.toMatch(/border-radius/i);
  });

  it("builds the subject from product and variant", () => {
    expect(restockSubject("Remera Oversize", "Negro / M")).toBe(
      "Volvió tu talle: Remera Oversize (Negro / M)",
    );
  });
});
