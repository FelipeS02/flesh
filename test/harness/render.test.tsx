import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HarnessProbe } from "../fixtures/harness-probe";

describe("Vitest + RTL harness — component rendering", () => {
  it("renders an inline React component and reflects its prop in the DOM", () => {
    render(<HarnessProbe name="FLESH" />);

    expect(screen.getByTestId("harness-probe").textContent).toBe(
      "Hello, FLESH!",
    );
  });

  it("reflects a different prop value, proving the render is not hardcoded", () => {
    render(<HarnessProbe name="Vitest" />);

    expect(screen.getByTestId("harness-probe").textContent).toBe(
      "Hello, Vitest!",
    );
  });
});
