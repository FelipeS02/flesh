import type { Metadata } from "next";
import Image from "next/image";
import FleshLogotype from "@/components/shared/flesh-logotype";
import { readAccessGateConfig } from "@/modules/access-gate/api/config";
import { unlockAccessGate } from "@/modules/access-gate/api/unlock.action";
import { GateScreen } from "@/modules/access-gate/ui/gate-screen";
import { RichSubtitle } from "@/modules/access-gate/ui/rich-subtitle";

export const metadata: Metadata = {
  title: "Acceso",
};

const DEFAULT_MESSAGE = "SITIO EN **CONSTRUCCIÓN**";

export default function AccessGatePage() {
  // Read directly rather than trusting the proxy already filtered this: the
  // page itself must degrade the same way (default subtitle, no crash) if
  // this route is ever reached with the gate disabled or misconfigured.
  const config = readAccessGateConfig();
  const message = config.enabled ? config.message : DEFAULT_MESSAGE;

  return (
    // `bg-background` here is what hides the sitewide video plate: the plate
    // sits at `-z-10` behind everything (see `background-plate.tsx`), and any
    // normal, opaquely-painted element in front of it already covers it — no
    // `PageScrim` needed for a fully solid ground.
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background px-4">
      {/* Decorative crest, not content: centred and SQUARE so the 2362×2362
          source is never cropped, sat behind the card via z-index rather
          than removed from flow, at low opacity so it reads as texture. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      >
        <div className="relative aspect-square w-full max-w-[720px] opacity-10">
          <Image
            src="/password_ilustration.webp"
            alt=""
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative z-10 flex w-[342px] flex-col items-center md:w-[416px]">
        <div className="flex flex-col items-center gap-5">
          <FleshLogotype className="w-[300px] md:w-[340px]" />
          <RichSubtitle
            text={message}
            className="text-center font-sans text-sm uppercase tracking-[0.15em] text-foreground"
          />
        </div>
        <div className="mt-8 w-full">
          <GateScreen unlock={unlockAccessGate} />
        </div>
      </div>
    </main>
  );
}
