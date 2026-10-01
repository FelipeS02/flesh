# Archived Embla-era product gallery

Verbatim copies of the PDP gallery as it stood at commit `50de458`, taken
before Embla was removed from the live module. Kept so it can be restored, not
because anything uses it: this folder is excluded from `tsc`, ESLint and
Vitest, so it never compiles, lints or runs.

## What is in it

- `product-gallery.tsx`: the component, with both desktop engines selectable
  by `DESKTOP_GALLERY_ENGINE` (`'native-scroll'` or `'embla'`).
- `use-embla-desktop.ts`, `use-wheel-navigation.ts`: the controlled Embla
  desktop engine and its one-slide-per-gesture wheel.
- `use-native-desktop-scroll.ts`: the native desktop engine's paint hook.
- `slide-blur.ts`: the blur / mask maths for both engines.
- `gallery-config.ts`: the hand-toggled flags.
- `__tests__/`: the four test files that covered the above.

## What it depends on

- `@/components/ui/carousel` (the shadcn carousel, kept in the repo for this).
- `embla-carousel-react` (still in `package.json` for the same reason).

## How to restore

1. Copy every file here back into `src/modules/product-detail/gallery/`,
   overwriting the live ones, and the tests into its `__tests__/`.
2. Fix the one relative import in the restored tests that climbs to
   `test/fixtures/viewport` (they sat one folder deeper here).
3. Delete this folder, or leave it and its three tooling exclusions
   (`tsconfig.json`, `eslint.config.mjs`, `vitest.config.mts`) alone.
4. Run `npm test`, `npm run typecheck` and `npm run lint`.
