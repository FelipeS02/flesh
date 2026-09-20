/**
 * jsdom implements no layout, and therefore no `window.matchMedia`. Anything
 * that reads a breakpoint OR a user preference in JS — the gallery's carousel
 * axis, which embla fixes at init and CSS cannot reach, and the background
 * plate's motion preference, which decides whether a megabyte of video is
 * fetched at all — needs one here.
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
let reducedMotion = false;

/**
 * Matches the `(min-width: Npx)`, `(max-width: Npx)` and
 * `(prefers-reduced-motion: reduce)` forms the app writes.
 */
function evaluate(query: string): boolean {
  if (/\(prefers-reduced-motion:\s*reduce\)/.test(query)) {
    return reducedMotion;
  }

  const min = /\(min-width:\s*(\d+)px\)/.exec(query);
  if (min) {
    return width >= Number(min[1]);
  }

  const max = /\(max-width:\s*(\d+)px\)/.exec(query);
  if (max) {
    return width <= Number(max[1]);
  }

  throw new Error(
    `viewport stub: unsupported media query ${JSON.stringify(query)}. ` +
      `Only '(min-width: Npx)', '(max-width: Npx)' and ` +
      `'(prefers-reduced-motion: reduce)' are modelled — extend this helper ` +
      `rather than letting an unmatched query silently report false.`,
  );
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

/**
 * Declares that the viewer asked their OS to reduce motion, and notifies
 * everything already subscribed.
 *
 * Separate from `setViewport` because it is not a size: a phone and a desktop
 * each carry their own answer, so folding it into `VIEWPORTS` would make the
 * two impossible to vary independently.
 */
export function setReducedMotion(value: boolean): void {
  reducedMotion = value;

  for (const { list, listeners } of lists) {
    for (const listener of listeners) {
      listener({ matches: list.matches, media: list.media } as MediaQueryListEvent);
    }
  }
}

/**
 * Drops subscriptions between tests and returns to the mobile default with
 * motion allowed — the settings the overwhelming majority of visitors carry,
 * so a test that depends on either one has to say so out loud.
 */
export function resetViewport(): void {
  lists.clear();
  width = VIEWPORTS.mobile;
  reducedMotion = false;
}
