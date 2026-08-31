// Test-only fixture (not production source). Rendered by
// `test/harness/render.test.tsx` to prove jsdom + React Testing Library +
// the `@vitejs/plugin-react` JSX transform work together under Vitest.
export function HarnessProbe({ name }: { name: string }) {
  return <p data-testid="harness-probe">Hello, {name}!</p>;
}
