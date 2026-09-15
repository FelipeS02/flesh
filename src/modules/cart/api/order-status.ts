import "server-only";
import { z } from "zod";
import type { TiendanubeConfig } from "@/modules/catalog";

const API_ORIGIN = "https://api.tiendanube.com";
const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Only `number` is requested, and only `number` is read.
 *
 * The same endpoint would return the buyer's name, email, address and payment
 * details; asking for one integer means none of that is ever fetched, logged or
 * held in memory to answer a yes/no question.
 */
const OrderNumberSchema = z.object({ number: z.number().int() });

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type Dependencies = {
  config: TiendanubeConfig;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

/**
 * Answers whether the draft order behind a handed-off cart became a real order.
 *
 * A draft order and the order it converts into share one id, so this record is
 * readable through `/orders/{id}` either way — an abandoned checkout answers
 * 200 exactly like a completed one. The difference is `number`: Tiendanube
 * leaves it at 0 while the record is still a draft and assigns the real order
 * number when it converts.
 *
 * Do NOT reach for `status` or `payment_status` instead. A store whose payment
 * method is arranged off-platform reports `open`/`pending` on a genuinely
 * completed order, so those fields cannot tell the two apart at all.
 *
 * Every uncertain outcome returns false, which keeps the cart. The two mistakes
 * are not symmetric: a cart that outlives its purchase is a nuisance the shopper
 * can fix in one click, while a cart emptied because a request timed out is
 * their work destroyed and, very likely, a sale lost.
 */
export async function hasCompletedOrder(
  orderId: number,
  { config, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: Dependencies,
): Promise<boolean> {
  const url = new URL(`/v1/${config.storeId}/orders/${orderId}`, API_ORIGIN);
  url.searchParams.set("fields", "number");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.accessToken}`,
        "user-agent": config.userAgent,
      },
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const parsed = OrderNumberSchema.safeParse(await response.json());
    return parsed.success && parsed.data.number > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
