import { cn } from "@/lib/utils";

/**
 * The brand's claims channel.
 *
 * Two forms of one number because they are read by different things: `display`
 * is how a person says it out loud, `href` is what wa.me accepts — no plus, no
 * spaces, no dashes. Keeping them side by side is what stops the link and the
 * printed number from drifting apart.
 */
export const WHATSAPP = {
  display: "+54 9 11 3926-9165",
  href: "https://wa.me/5491139269165",
} as const;

type ReturnsPolicyProps = {
  /**
   * Type scale only. Merged with `cn`, so a caller's `text-sm` replaces the
   * accordion default rather than fighting it in the cascade.
   *
   * Exists because the same copy is read in two very different places: folded
   * into an accordion beside the garment, and alone on `/devoluciones`, where
   * it is the entire page and deserves the bigger setting.
   */
  className?: string;
  /**
   * Whether the size table and the fit scale are on the same screen, directly
   * above this copy.
   *
   * A prop and not a constant because the sentence it gates — "La tabla de
   * talles y la escala de calce están acá arriba" — is a POINTER, and a
   * pointer is only true where it points at something. On the PDP it does;
   * on `/devoluciones`, where this copy is the whole page, it would send a
   * reader up to a header. The policy itself is identical in both places;
   * only the directions are not.
   */
  sizeGuideNearby?: boolean;
};

/**
 * Store policy: final sale, with a manufacturing-fault exception.
 *
 * Copy the brand wrote, not copy we chose. Every commitment in it is a promise
 * to a customer — the seven-day window, the claims channel, and the shopper's
 * choice between a replacement and a refund — so it is edited here, in one
 * place, and nowhere else. It lives under `modules/legal` rather than under
 * the PDP for exactly that reason: two screens render it, and neither owns it.
 */
export function ReturnsPolicy({ className, sizeGuideNearby = false }: ReturnsPolicyProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 font-sans text-xs leading-relaxed text-muted-foreground md:text-[13px]",
        className,
      )}
    >
      <p>
        Trabajamos con drops de stock limitado, así que todas las ventas son finales:
        no hacemos cambios ni devoluciones por talle, color ni arrepentimiento de
        compra.
        {sizeGuideNearby && (
          <> La tabla de talles y la escala de calce están acá arriba para que elijas
          sin dudar.</>
        )}
      </p>

      <p className="text-foreground">Falla de fábrica o daño en el envío</p>

      <p>
        Tenés 7 días desde la entrega para reportarlo. Escribinos por WhatsApp al{" "}
        <a
          href={WHATSAPP.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-4"
        >
          {WHATSAPP.display}
        </a>{" "}
        con tu número de pedido y fotos del problema. Evaluamos el caso y lo
        resolvemos con cambio por la misma prenda o reembolso, a tu elección, según
        disponibilidad de stock.
      </p>

      <p>Pasados los 7 días no podemos procesar el reclamo.</p>
    </div>
  );
}
