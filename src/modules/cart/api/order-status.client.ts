import type { OrderStatusPort } from "./port";
import { hasCompletedPendingCheckout } from "./order-status.action";

type HasCompletedCheckoutAction = () => Promise<boolean>;

export function createOrderStatusPort(
  action: HasCompletedCheckoutAction = hasCompletedPendingCheckout,
): OrderStatusPort {
  return { hasCompletedCheckout: () => action() };
}
