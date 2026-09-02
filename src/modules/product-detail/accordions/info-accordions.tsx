import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import type { ProductView } from "@/modules/catalog/client";
import { findSizeAxis, type GarmentCut } from "../garment/cuts";
import { ReturnsPolicy } from "./returns-policy";
import { SizeTable } from "./size-table";

type InfoAccordionsProps = {
  product: Pick<ProductView, "descriptionHtml" | "axes">;
  /** The product's pattern, or `null` when we cannot name it — see `../garment/cuts`. */
  cut: GarmentCut | null;
};

type Section = {
  title: string;
  content: ReactNode;
};

/**
 * The `name` that makes the three sections ONE accordion.
 *
 * Shared between `<details>` elements, it is the browser's own exclusive-group
 * mechanism: opening one closes the others, with no state to hold and no
 * JavaScript to ship. A browser too old for it degrades to three independent
 * disclosures — the content is all still reachable, which is the only property
 * that actually matters.
 */
const ACCORDION_GROUP = "product-info";

/**
 * The three expandable sections under the purchase panel.
 *
 * Native `<details>`/`<summary>`, so this stays a SERVER component and ships no
 * JavaScript: the browser owns the open state, the exclusive grouping (see
 * `ACCORDION_GROUP`) and the expand animation (see `globals.css`). It works
 * before hydration and with scripting off, which a Radix accordion does not.
 */
export function InfoAccordions({ product, cut }: InfoAccordionsProps) {
  const sections: Section[] = [
    {
      title: "Información",
      content: <Description html={product.descriptionHtml} />,
    },
    // Dropped entirely rather than rendered empty: with no registered pattern
    // there are no measurements, and an open section promising a size table
    // that is not there is worse than no section.
    ...(cut
      ? [
          {
            title: "Tabla de talles",
            content: <SizeTable cut={cut} sizeAxis={findSizeAxis(product)} />,
          },
        ]
      : []),
    {
      title: "Cambios y devoluciones",
      content: <ReturnsPolicy />,
    },
  ];

  return (
    <section className="flex w-full flex-col">
      {sections.map((section, index) => (
        // Numbered by POSITION ON SCREEN, not by a fixed slot per section: when
        // the size table drops out, a jump from 01 to 03 reads as a section
        // that failed to load rather than as one that does not apply.
        //
        // Only the first opens. The artboard drew two panels expanded, but an
        // exclusive group cannot honour that — a second `open` is silently
        // dropped by the browser, so choosing here is choosing on purpose.
        <AccordionSection
          key={section.title}
          number={index + 1}
          section={section}
          defaultOpen={index === 0}
        />
      ))}

      {/* The artboard closes the stack with a rule of its own, so the last
          section has a floor as well as a ceiling. */}
      <div className="border-t border-border" />
    </section>
  );
}

function AccordionSection({
  number,
  section,
  defaultOpen,
}: {
  number: number;
  section: Section;
  defaultOpen: boolean;
}) {
  return (
    <details
      name={ACCORDION_GROUP}
      open={defaultOpen}
      data-accordion
      className="group border-t border-border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3 font-sans tracking-control">
          <span className="text-[9px] text-muted-foreground md:text-[10px]">
            {String(number).padStart(2, "0")}
          </span>
          <span className="text-[13px] text-foreground md:text-sm">{section.title}</span>
        </span>

        {/* The sign is decoration: `<details>` already announces its own
            expanded state, so a screen reader that read these would hear the
            state twice, once of them wrong. */}
        <Plus aria-hidden className="size-3.5 text-muted-foreground group-open:hidden" />
        <Minus
          aria-hidden
          className="hidden size-3.5 text-muted-foreground group-open:block"
        />
      </summary>

      <div className="pb-7">{section.content}</div>
    </details>
  );
}

/**
 * The merchant's own description.
 *
 * The artboard's spec bullets live here, not in a field of our own: the
 * sanitiser's allowlist already passes `ul`/`li`, so a merchant writing a list
 * in Tiendanube's description gets one — and inventing a `specs` field would
 * have meant inventing wire data, which is the one thing the catalog module
 * does not do.
 *
 * `descriptionHtml` is a `SafeHtml`, and only `catalog/lib/sanitize` can mint
 * one. That brand is what makes this the single safe call site of
 * `dangerouslySetInnerHTML`.
 */
function Description({ html }: { html: ProductView["descriptionHtml"] }) {
  return (
    <div
      className="flex flex-col gap-4 font-sans text-xs leading-relaxed text-muted-foreground md:text-[13px] [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-3 [&_ul]:pl-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
