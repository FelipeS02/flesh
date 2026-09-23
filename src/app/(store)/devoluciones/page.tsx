import type { Metadata } from "next";
import { PageScrim } from "@/components/shared/background-plate";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { ReturnsPolicy } from "@/modules/legal/returns-policy";

export const metadata: Metadata = {
  title: "Devoluciones",
  description:
    "Politica de cambios y devoluciones: ventas finales, con excepcion por falla de fabrica o dano en el envio dentro de los 7 dias.",
};

/**
 * The returns policy as a screen of its own, reachable from the footer nav.
 *
 * It renders the SAME `ReturnsPolicy` the PDP accordion folds away — not a
 * second copy of the wording. Every line in it is a commitment to a customer,
 * so two versions of it is two versions of what the brand promised, and the
 * one nobody remembered to edit is the one that ends up in a dispute.
 *
 * Static: nothing here reads params, a cookie or the query string, so the
 * whole route prerenders.
 */
export default function ReturnsPage() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col gap-10 px-4 md:px-0">
      {/* A SECOND scrim, on top of the one `BackgroundPlate` already lays
          down: two `#00000070` layers composite to ~69% black instead of
          ~44%. Deliberate here and nowhere else — this page is a long column
          of policy prose read over a moving video, and the sitewide baseline
          does not give it enough ground to stay legible. */}
      <PageScrim />
      <Header />

      {/* Narrower than the PDP’s content column on purpose: this page is a
          single column of prose, and prose set much past ~70 characters costs
          the reader the start of the next line. */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 md:px-18">
        <h1 className="font-display text-3xl leading-[1.05] text-primary md:text-[45px]">
          Cambios y devoluciones
        </h1>

        <ReturnsPolicy className="text-sm md:text-base" />
      </main>

      <Footer />
    </div>
  );
}
