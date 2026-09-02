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

/**
 * Store policy: final sale, with a manufacturing-fault exception.
 *
 * Copy the brand wrote, not copy we chose. Every commitment in it is a promise
 * to a customer — the seven-day window, the claims channel, and the shopper's
 * choice between a replacement and a refund — so it is edited here, in one
 * place, and nowhere else.
 */
export function ReturnsPolicy() {
  return (
    <div className="flex flex-col gap-4 font-sans text-xs leading-relaxed text-muted-foreground md:text-[13px]">
      <p>
        Trabajamos con drops de stock limitado, así que todas las ventas son finales:
        no hacemos cambios ni devoluciones por talle, color ni arrepentimiento de
        compra. La tabla de talles y la escala de calce están acá arriba para que
        elijas sin dudar.
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
