/**
 * jsdom implements no layout, and therefore no `window.matchMedia`. Anything
 * that reads a breakpoint in JS — today only the gallery's carousel axis,
 * which embla fixes at init and CSS cannot reach — needs one here.
 *
 * The stub is deliberately not a no-op returning `false`: a gallery that is
 * horizontal in every test can never prove the desktop half of its own
 * contract. Tests declare a viewport instead, and `setViewport` re-evaluates
 * every live listener so a component already mounted reacts the way it would
 * to a real resize.
 */
type MediaQueryListener = (event: MediaQueryListEvent) => void;

type StubbedList = MediaQueryList & { readonly query: string };

const lists = new Set<{ list: StubbedList; listeners: Set<MediaQueryListener> }>();

let width = 390;

/** Matches only the `(min-width: Npx)` form the app actually writes. */
function evaluate(query: string): boolean {
  const match = /\(min-width:\s*(\d+)px\)/.exec(query);

  if (!match) {
    throw new Error(
      `viewport stub: unsupported media query ${JSON.stringify(query)}. ` +
        `Only '(min-width: Npx)' is modelled — extend this helper rather ` +
        `than letting an unmatched query silently report false.`,
    );
  }

  return width >= Number(match[1]);
}

export const VIEWPORTS = {
  // The artboard sizes, so a failure names a screen someone can picture.
  mobile: 390,
  desktop: 1440,
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

/**
 * Installs the stub. Call once from the global setup file; individual tests
 * use `setViewport`.
 */
export function installMatchMediaStub(): void {
  window.matchMedia = (query: string): MediaQueryList => {
    const listeners = new Set<MediaQueryListener>();

    const list = {
      query,
      get matches() {
        return evaluate(query);
      },
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: MediaQueryListener) => {
        if (type === "change") listeners.add(listener);
      },
      removeEventListener: (type: string, listener: MediaQueryListener) => {
        if (type === "change") listeners.delete(listener);
      },
      // Deprecated pair, kept because some libraries still feature-detect it.
      addListener: (listener: MediaQueryListener) => listeners.add(listener),
      removeListener: (listener: MediaQueryListener) => listeners.delete(listener),
      dispatchEvent: () => true,
    } as unknown as StubbedList;

    lists.add({ list, listeners });

    return list;
  };
}

/** Resizes the stubbed viewport and notifies everything already subscribed. */
export function setViewport(name: ViewportName): void {
  width = VIEWPORTS[name];

  for (const { list, listeners } of lists) {
    for (const listener of listeners) {
      listener({ matches: list.matches, media: list.media } as MediaQueryListEvent);
    }
  }
}

/** Drops subscriptions between tests and returns to the mobile default. */
export function resetViewport(): void {
  lists.clear();
  width = VIEWPORTS.mobile;
}
