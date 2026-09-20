"use client";

import { useState, useSyncExternalStore } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkullsBackdrop } from "@/components/ui/skulls-background";
import {
  createCookieNoticeStorage,
  type CookieNoticeStorage,
} from "./cookie-notice.storage";

/**
 * Lazily built and cached at module scope, NOT at import time — which is the
 * distinction `createCookieNoticeStorage`'s own doc draws. Only `getSnapshot`
 * below reaches this, and React never calls that on the server, so `window`
 * is guaranteed to exist by the time this line runs.
 */
let browserStorage: CookieNoticeStorage | null = null;

function resolveStorage(injected?: CookieNoticeStorage): CookieNoticeStorage {
  if (injected) return injected;

  return (browserStorage ??= createCookieNoticeStorage(window.localStorage));
}

/**
 * Nothing ever changes this store behind our back. The one write that exists
 * is our own dismissal, and that already re-renders through `dismissed`
 * below, so a real subscription would only be machinery to deliver an event
 * we are standing next to when it happens.
 */
const noSubscription = () => () => {};

type CookieNoticeProps = {
  /** Injected by the tests; production reads `window.localStorage`. */
  storage?: CookieNoticeStorage;
};

/**
 * The cookie notice: an ANNOUNCEMENT, not a consent gate.
 *
 * Nothing here is switchable, and that is the decision this component
 * encodes rather than a feature it has yet to grow. There is no "reject", no
 * per-category toggle and no "configure" — the site's cookies are the ones it
 * needs to work, they load either way, and a control that pretends otherwise
 * would be a lie drawn in the brand's own type.
 *
 * Consequence worth stating where someone will read it: this is NOT GDPR
 * consent. Analytics and the Meta Pixel boot from the root layout before a
 * shopper touches anything. For an Argentine storefront under Ley 25.326 an
 * informative notice is the right instrument; the day this sells into the EU,
 * this component is not the thing to patch — the boot order is.
 */
export function CookieNotice({ storage }: CookieNoticeProps) {
  const [dismissed, setDismissed] = useState(false);

  /**
   * `localStorage` is an external store, and this is the hook that exists to
   * read one without lying to the server.
   *
   * The server snapshot is `true` — "already acknowledged" — so the server,
   * and the first client render that has to match it, emit NOTHING. React
   * then re-reads through `getSnapshot` once hydration is done and the real
   * answer arrives a beat later. Guessing the other way would flash the panel
   * at every shopper who dismissed it months ago, and reading storage during
   * render would be a hydration mismatch.
   *
   * An effect writing this into state was the first shape of this, and the
   * React Compiler's `set-state-in-effect` rule is right to reject it: that
   * renders once with a wrong answer and then corrects it, which is the flash
   * this is trying to avoid, merely made shorter.
   */
  const acknowledged = useSyncExternalStore(
    noSubscription,
    () => resolveStorage(storage).acknowledged(),
    () => true,
  );

  if (acknowledged || dismissed) return null;

  function dismiss() {
    // State first, storage second. The notice leaves the screen on the click
    // that asked for it, and the write — which the adapter guarantees will
    // not throw — follows.
    setDismissed(true);
    resolveStorage(storage).acknowledge();
  }

  return (
    // `isolate` and `overflow-hidden` are `SkullsBackdrop`'s stated contract:
    // at `-z-1` under a parent that opens no stacking context of its own, the
    // plate paints beneath this panel's opaque background instead of above it
    // — the exact bug the cart toast shipped with once.
    //
    // It rises from the bottom edge it is pinned to. Dropping in from above,
    // the way the cart toast does, would describe a journey from the header,
    // which is not where this comes from.
    <section
      aria-label="Política de cookies"
      className="fixed bottom-5 left-5 z-50 isolate w-[min(350px,100vw-40px)] overflow-hidden border border-border bg-background p-5 shadow-lg duration-200 ease-out animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      <SkullsBackdrop />
      <p className="font-display tracking-control text-foreground">
        Política de Cookies
      </p>
      {/* Three elements and not one sentence with a `<strong>` inside it: the
          middle line is the one a shopper has to actually read, and giving it
          its own line is what the artboard does. Kept as one `<p>` per line so
          a screen reader pauses between them the way the eye does. */}
      <div className="mt-2 font-sans text-xs leading-relaxed text-balance">
        <span className="text-muted-foreground">Al navegar por este sitio</span>{" "}
        <span className="text-foreground">aceptás el uso de cookies</span>{" "}
        <span className="text-muted-foreground">
          para agilizar tu experiencia de compra
        </span>{" "}
      </div>
      {/* The design system's own `Button`, not a bare element, for the focus
          ring and press feedback — the same treatment `AddedToast` gives the
          one control inside a toast. */}
      <Button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        variant="ghost"
        size="icon-xs"
        className="absolute top-3 right-3 text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <XIcon />
      </Button>
    </section>
  );
}
