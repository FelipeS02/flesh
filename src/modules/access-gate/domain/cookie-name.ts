// Split out of `unlock.action.ts` so `src/proxy.ts` (Edge, no "use server")
// can import the cookie name without importing a "use server" file — every
// top-level export of a "use server" module must be an async server action,
// and a plain string constant is not one.
export const ACCESS_GATE_COOKIE_NAME = "flesh_access";
