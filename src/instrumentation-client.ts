import { initBotId } from "botid/client/core";

// Every path, not `/carrito` or the like: a Server Action POSTs to whatever page
// it was invoked from, and the checkout lives in the cart drawer, which the
// layout mounts on every route. A narrower pattern would leave the checkout
// unsigned on most pages and `checkBotId()` would refuse real shoppers there.
initBotId({
  protect: [{ path: "/*", method: "POST" }],
});
