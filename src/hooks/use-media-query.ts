"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reads a media query from JS.
 *
 * Reach for this ONLY when CSS genuinely cannot express the rule. Every
 * breakpoint answered in JS costs a hydration pass where the server's guess
 * is on screen, so a `md:` class is always the better answer when one exists.
 * The gallery uses it because embla fixes its scroll axis at initialisation
 * and no stylesheet can reach that decision.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: it subscribes
 * and reads in one tear-free step, so a component cannot render against a
 * snapshot that changed between the read and the paint.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);

      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  // The server has no viewport to measure. Reporting `false` makes the
  // narrow layout the one that renders first everywhere — the safe default,
  // since a phone then needs no correction at all and only desktop pays a
  // single post-hydration adjustment.
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
