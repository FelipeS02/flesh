import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { toSafeHtml } from "@/modules/catalog/lib/sanitize";
import { InfoAccordions } from "../info-accordions";

const descriptionHtml = toSafeHtml("<p>A garment.</p>");

function section(title: RegExp): HTMLDetailsElement | undefined {
  return screen.getAllByRole("group").find((element) => title.test(element.querySelector("summary")?.textContent ?? "")) as HTMLDetailsElement | undefined;
}

describe("InfoAccordions", () => {
  it("keeps Fit outside its size chart contract and shows a chart only when it is renderable", () => {
    render(<InfoAccordions product={{ descriptionHtml, sizeChart: [{ size: "M", measurements: { chest_width: 52 } }] }} />);
    expect(section(/talles/i)).toBeTruthy();
    expect(screen.getByText("Ancho de pecho")).toBeTruthy();
  });

  it("omits an empty size chart and keeps consecutive section numbers", () => {
    render(<InfoAccordions product={{ descriptionHtml, sizeChart: [{ size: "M", measurements: {} }] }} />);
    expect(section(/talles/i)).toBeUndefined();
    expect(section(/cambios/i)?.textContent).toContain("02");
  });
});
