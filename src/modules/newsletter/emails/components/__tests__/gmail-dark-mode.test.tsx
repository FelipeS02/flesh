// @vitest-environment node
import { render } from "react-email";
import { describe, expect, it } from "vitest";
import RestockEmail from "../../templates/restock";

// Gmail's iOS app fully inverts a message in dark mode, which turned this black
// email white. These pin the two workarounds; whether they hold is only
// provable on a device (`pnpm email:test`), not here.
describe("Gmail dark-mode workarounds", () => {
  const html = () => render(<RestockEmail {...RestockEmail.PreviewProps} />);

  it("repeats every solid background as a gradient, which Gmail never inverts", async () => {
    const markup = await html();

    expect(markup).toMatch(/background-image:\s*linear-gradient\(#000000,\s*#000000\)/);
    expect(markup).toMatch(/background-image:\s*linear-gradient\(#0A0A0A,\s*#0A0A0A\)/);
    expect(markup).toMatch(/background-image:\s*linear-gradient\(#DC2626,\s*#DC2626\)/);
  });

  it("ships the blend rules scoped to Gmail by its u + .body wrapper", async () => {
    const markup = await html();

    expect(markup).toMatch(/<style[^>]*>[^<]*u \+ \.body \.gmail-blend-screen[^<]*mix-blend-mode:\s*screen/);
    expect(markup).toMatch(/u \+ \.body \.gmail-blend-difference[^<]*mix-blend-mode:\s*difference/);
    expect(markup).toMatch(/<body[^>]*class="body"/);
  });

  it("wraps the white copy in the blend layers", async () => {
    const markup = await html();
    const wrapped = /class="gmail-blend-screen"[^>]*>\s*<div[^>]*class="gmail-blend-difference"/g;

    // Eyebrow, body line, price block and footer.
    expect(markup.match(wrapped)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
