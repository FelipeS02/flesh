<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project conventions

## shadcn first — this is not a preference, it is the design system

`src/components/ui/` is the design system. When it already provides a component for what you are building, **use it**; when shadcn ships one that fits and the project does not have it yet, **install it**. Do not hand-roll a `<button>`, dialog, drawer, or any other primitive it covers.

The reason is not tidiness. Those components carry the focus-visible ring, disabled handling, press feedback, `aria-*` wiring and icon sizing that a hand-written element silently lacks — the cart drawer had to be rebuilt onto `Sheet` once already for exactly this.

Composing rather than replacing: Base UI parts (`SheetClose`, `Toast.Close`, …) take a `render` prop, so pass the design system's `Button` into it instead of writing a bare element. `cn()` is `twMerge`, so per-use overrides in `className` win cleanly over a variant's defaults.

Deviating is allowed when the design genuinely calls for it — say so in a comment at the call site, naming what the component could not do.

## Hard edges

`--radius` is `0`. Every corner in this app is square; the only round things are circles asked for explicitly with `rounded-full`. Do not reintroduce a radius scale or add `rounded-*` to app components.

## Spanish ships, English is written

Shopper-facing copy is Spanish and stays Spanish, exactly as specified — `AGREGADO AL CARRITO`, `QUITAR`, `Finalizar compra`. Everything else is English: identifiers, comments, commit messages, test names, docs.

## Comments explain WHY

This codebase's comments carry the reasoning and name the failure the code prevents; they never restate the line below them. Match that register, and when a comment's reasoning stops being true, rewrite it rather than leaving it to contradict the code.

## Tests live in `__tests__/`

Every test sits in a `__tests__/` folder beside the code it covers, one folder
per layer: `src/modules/cart/api/__tests__/storage.test.ts` covers
`src/modules/cart/api/storage.ts`.

Per layer, not per module, and that is the part worth keeping. `cart` alone has
34 test files; collapsing them into one folder per module loses which layer each
belongs to, which is the only thing that makes a list that long navigable.

So a test's relative imports climb one extra level — `../storage`, never
`./storage`. Shared fixtures stay in `test/fixtures/`, and `test/harness/` stays
put: it is already a test directory with nothing to sit beside.

## Product custom fields are written through a script

`colourway`, `fit` and `size_chart` live in Tiendanube, but its admin cannot
edit them — `scripts/custom-fields.mjs` is the only writer. Use the
`product-fields` skill (`.claude/skills/product-fields/`) to change them.
