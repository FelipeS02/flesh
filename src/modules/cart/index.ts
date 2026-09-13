/** The sole public crossing point into the cart module. */
export { CartProvider, useCartDispatch, useCartEnvironment, useCartState } from "./state/cart-context";
export { itemCount } from "./domain/selectors";
export { CartDrawer } from "./ui/drawer";
export { CartToastViewport } from "./ui/toast/cart-toast-viewport";
export { showAddedToCart } from "./ui/toast/manager";
export type { CheckoutPort } from "./api/port";
