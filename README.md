This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Analytics rollout

The storefront sends pre-checkout ecommerce events directly to GA4. Tiendanube
owns the hosted checkout and purchase funnel, so this app MUST NOT emit
`begin_checkout`, shipping, payment, or `purchase` events.

### Environment variables

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Client | No | Enables the Google tag when it matches `G-...`. Omit it to disable analytics, including local development. |
| `TIENDANUBE_CHECKOUT_HOST` | Server | Yes | Exact bare hostname accepted for draft-order checkout redirects, for example `checkout.example.com`. URLs, paths, wildcard domains, and ports are rejected. |

Use a separate GA4 web data stream and measurement ID for every deployed
environment. Never reuse the production ID in preview deployments.
Changing either variable requires a new build and deployment.

### Cross-domain continuity

In the production GA4 web stream, configure cross-domain measurement for the
storefront hostname and the exact Tiendanube checkout hostname. The checkout
handoff is a user-clicked HTTPS anchor so the Google tag can decorate it with
the linker parameter; the application does not manufacture linker values.

Before release, use Tag Assistant and GA4 DebugView to confirm:

1. `page_view` fires once on the first pathname and once per pathname change,
   but not for query-only filter changes.
2. Catalog, product, and cart interactions emit only the allowlisted events:
   `view_item_list`, `select_item`, `view_item`, `add_to_cart`, `view_cart`, and
   `remove_from_cart`.
3. The checkout link emits `checkout_redirect` once and carries the decorated
   linker parameter to the configured Tiendanube host.
4. Ecommerce payloads contain no buyer name, email, address, cookie value, or
   other PII. Variants without a SKU keep `item_name` and omit `item_id`.
5. Tiendanube emits the downstream paid-order `purchase` event exactly once;
   the storefront does not duplicate it.

Do not release until all five checks pass against the production stream and
checkout host. To roll analytics back without reverting storefront code,
remove `NEXT_PUBLIC_GA_MEASUREMENT_ID` and rebuild. If checkout-host validation
blocks a legitimate provider URL, restore the last known exact hostname and
rebuild; never relax the guard to a suffix or wildcard match.
