import type { CheckoutOutcome, CheckoutPort } from "./port";
import { startTiendanubeCheckout } from "./checkout.action";
import { CHECKOUT_FAILURE_REASON } from "./checkout-messages";
import { isSafeCheckoutUrl } from "./checkout-url";

type CheckoutAction = (input: unknown) => Promise<CheckoutOutcome>;

export function createTiendanubeCheckout(action: CheckoutAction = startTiendanubeCheckout): CheckoutPort {
  return { async startCheckout(cart) {
    const outcome = await action(cart);
    return outcome.status === "redirect" && !isSafeCheckoutUrl(outcome.url)
      ? { status: "unavailable", reason: CHECKOUT_FAILURE_REASON }
      : outcome;
  } };
}
