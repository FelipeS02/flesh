import Image from "next/image";
import Link from "next/link";
import FleshLogotype from "@/components/shared/flesh-logotype";
import { Button } from "@/components/ui/button";

/**
 * The 404 for any URL no route matches.
 *
 * Root-level, so it renders inside the root layout only — no `(store)` shell,
 * no video plate, no cart. `bg-background` is therefore a real ground, the same
 * one `/acceso` stands on, and the gate's skull is borrowed here as the zero of
 * the numeral.
 */
export default function NotFound() {
  return (
    <main className="relative flex min-h-svh w-full flex-col items-center justify-center bg-background px-4">
      <Link
        href="/"
        aria-label="FLESH inicio"
        className="absolute top-10 left-1/2 -translate-x-1/2 md:top-11"
      >
        <FleshLogotype className="w-20 md:w-40" />
      </Link>

      {/* One image to assistive tech, labelled with the number it draws:
          left alone it would be announced as "4, 4" around a picture with no
          name, because the zero is not a character at all. */}
      <div
        role="img"
        aria-label="404"
        className="flex items-center gap-1 font-display text-[140px] leading-none text-foreground md:gap-2 md:text-[300px]"
      >
        <span>4</span>
        <span className="relative block aspect-square -mt-5 w-37.5 md:w-75">
          {/* The artwork's own ground is black, so at full opacity it melts
              into `bg-background` instead of showing as a square. */}
          <Image
            src="/password-illustration.webp"
            alt=""
            fill
            sizes="(min-width: 768px) 300px, 150px"
            className="object-contain"
          />
        </span>
        <span>4</span>
      </div>

      <div className="mt-6 flex w-full max-w-104 flex-col items-center gap-4 text-center">
        <h1 className="font-display text-[44px] leading-none text-foreground md:text-[56px]">
          Te perdiste
        </h1>
        {/* Cased in the source and uppercased in CSS, so a screen reader reads
            a sentence rather than spelling out capitals. */}
        <p className="font-sans text-[13px] leading-relaxed tracking-control text-muted-foreground uppercase">
          La página que buscás no existe, se movió o nunca estuvo acá.
        </p>
      </div>

      <Button
        asChild
        className="mt-8 h-16 w-full max-w-104 font-display text-xl hover:bg-primary/90 md:text-[28px]"
      >
        <Link href="/">Volver al catalogo</Link>
      </Button>
    </main>
  );
}
