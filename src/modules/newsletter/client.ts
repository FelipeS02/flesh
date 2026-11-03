// CLIENT crossing point into the newsletter module: the "use client" pieces
// other modules may render. Separate from `index.ts`, which is server-only
// (mailer, dispatcher, route handlers) and must never be imported from a
// client component — the same split `@/modules/catalog/client` makes.
export { NewsletterBanner, NewsletterBannerPreload } from "./ui/newsletter-banner";
export { RestockForm } from "./ui/restock-form";
