import type { Metadata } from "next";
import { UnsubscribeScreen } from "@/modules/newsletter/ui/unsubscribe-screen";

// The link carries a credential (the unsubscribe token) and has no value in a
// search index; `follow: false` also stops crawlers walking out of it.
export const metadata: Metadata = {
  title: "Baja del newsletter",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Lives outside `(store)` like `/acceso`: no catalog load, cart or trackers —
 * a person leaving the list should not be measured or shown a store shell.
 * Rendering never mutates; the client component does the unsubscribe after
 * mount (see its comment for why a GET must stay inert).
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;
  // A repeated `?token=a&token=b` is ambiguous, so it is treated as no token.
  return <UnsubscribeScreen token={typeof token === "string" ? token : null} />;
}
