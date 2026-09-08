/** The sole public crossing point into the cart module. */
export { CartProvider, useCartDispatch, useCartEnvironment, useCartState } from "./state/cart-context";
export { itemCount } from "./domain/selectors";
export { CartDrawer } from "./ui/drawer";
export type { CheckoutPort } from "./api/port";
