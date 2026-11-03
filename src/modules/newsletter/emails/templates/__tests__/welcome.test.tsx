// @vitest-environment node
import { render } from "react-email";
import { describe, expect, it } from "vitest";
import WelcomeEmail, { WELCOME_SUBJECT } from "../welcome";

const props = {
  baseUrl: "https://flesh.example",
  unsubscribeUrl: "https://flesh.example/newsletter/baja?t=abc",
};

describe("WelcomeEmail", () => {
  it("links the unsubscribe URL under the DARME DE BAJA label", async () => {
    const html = await render(<WelcomeEmail {...props} />);

    expect(html).toContain(props.unsubscribeUrl);
    expect(html).toContain("DARME DE BAJA");
  });

  it("builds the logo and store links from the given base URL", async () => {
    const html = await render(<WelcomeEmail {...props} />);

    expect(html).toContain('src="https://flesh.example/email/logotype.png"');
    expect(html).toContain('href="https://flesh.example"');
    expect(html).not.toContain("localhost");
  });

  it("carries the Spanish copy and subject", async () => {
    const html = await render(<WelcomeEmail {...props} />);

    expect(WELCOME_SUBJECT).toBe("Ya sos parte de FLESH");
    expect(html).toContain("Ya sos parte");
    expect(html).toContain("Ver la tienda");
    expect(html).toContain("NADA MÁS");
  });

  it("uses square corners only", async () => {
    expect(await render(<WelcomeEmail {...props} />)).not.toMatch(/border-radius/i);
  });
});

describe("WelcomeEmail dark mode", () => {
  it("pins the dark background with the legacy attribute for light-mode clients", async () => {
    expect(await render(<WelcomeEmail {...props} />)).toContain('bgcolor="#000000"');
  });
});
