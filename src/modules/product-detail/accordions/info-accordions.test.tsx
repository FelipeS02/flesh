import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { OptionAxis } from "@/modules/catalog/client";
import { toSafeHtml } from "@/modules/catalog/lib/sanitize";
import type { GarmentCut } from "../garment/cuts";
import { InfoAccordions } from "./info-accordions";
import { WHATSAPP } from "./returns-policy";

const CUT: GarmentCut = {
  key: "remera-oversize",
  fit: 65,
  measurements: [{ label: "Largo", bySize: { M: 68, L: 73 } }],
};

const SIZE_AXIS: OptionAxis = { index: 0, label: "Talle", values: ["M", "L"] };

function productWith(html: string, axes: OptionAxis[] = [SIZE_AXIS]) {
  return { descriptionHtml: toSafeHtml(html), axes };
}

/**
 * Sections are found by their SUMMARY text, not by an accessible name: a
 * `<details>` exposes the group role with no name of its own, and the summary
 * is the control that carries both the title and the expanded state. Labelling
 * the group to make it queryable would be ARIA added for a test's benefit.
 */
function sections(title: RegExp): HTMLDetailsElement[] {
  return screen
    .getAllByRole("group")
    .filter((element) => title.test(element.querySelector("summary")?.textContent ?? ""))
    .map((element) => element as HTMLDetailsElement);
}

function section(title: RegExp): HTMLDetailsElement {
  const [found] = sections(title);
  if (!found) {
    throw new Error(`No accordion section titled ${String(title)}`);
  }
  return found;
}

describe("InfoAccordions", () => {
  it("opens and closes with no JavaScript at all", () => {
    const { container } = render(
      <InfoAccordions product={productWith("<p>Una remera.</p>")} cut={CUT} />,
    );

    // Native `<details>`/`<summary>` is the entire mechanism. Every section is
    // static server-rendered content, so reaching for a client component here
    // would ship a bundle to do what the browser already does.
    expect(container.querySelectorAll("details")).toHaveLength(3);
    expect(container.querySelectorAll("summary")).toHaveLength(3);
  });

  it("files the merchant's description under the first section", () => {
    render(
      <InfoAccordions
        product={productWith("<p>Una remera.</p><ul><li>Algodón premium</li></ul>")}
        cut={CUT}
      />,
    );

    const info = section(/información/i);

    expect(info.textContent).toContain("Una remera.");
    // The sanitiser allows lists, so the artboard's spec bullets are merchant
    // copy rather than a field we would have to invent on the wire.
    expect(info.querySelectorAll("li")).toHaveLength(1);
  });

  it("opens on the description and leaves the rest shut", () => {
    render(<InfoAccordions product={productWith("<p>Una remera.</p>")} cut={CUT} />);

    expect(section(/información/i).open).toBe(true);
    expect(section(/talles/i).open).toBe(false);
    expect(section(/cambios/i).open).toBe(false);
  });

  it("binds the sections into one exclusive group, so only one stays open", () => {
    const { container } = render(
      <InfoAccordions product={productWith("<p>Una remera.</p>")} cut={CUT} />,
    );

    // A shared `name` is the browser's own accordion mechanism. Asserting the
    // wiring rather than the behaviour is deliberate: closing the siblings is
    // the browser's job, and jsdom does not implement it.
    const names = [...container.querySelectorAll("details")].map(
      (element) => element.getAttribute("name"),
    );

    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBeTruthy();
  });

  it("omits the size table for a product whose pattern we do not have", () => {
    render(<InfoAccordions product={productWith("<p>Una remera.</p>")} cut={null} />);

    expect(sections(/talles/i)).toHaveLength(0);
  });

  it("numbers the sections by what is on screen, never by a fixed slot", () => {
    // With no size table the policy moves up. A gap in the numbering would
    // read as a section that failed to load.
    render(<InfoAccordions product={productWith("<p>Una remera.</p>")} cut={null} />);

    expect(section(/cambios/i).textContent).toContain("02");
  });

  it("makes the claims number a WhatsApp link, not copy to retype", () => {
    render(<InfoAccordions product={productWith("<p>Una remera.</p>")} cut={CUT} />);

    const link = screen.getByRole("link", { name: /3926-9165/ });

    expect(link.textContent).toBe(WHATSAPP.display);
    expect(link.getAttribute("href")).toBe(WHATSAPP.href);
  });
});
