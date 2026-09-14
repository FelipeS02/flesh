import type { CartLineId } from '../api/port';
import { indexCartCatalog, type CartCatalog } from '../domain/catalog-projection';
import type { CheckoutUiState } from '../state/use-checkout';

/**
 * Shared between the drawer's one-click path and the buyer modal so the
 * wording can never drift between the two places a shopper can hit
 * `startCheckout` from (design: buyer-modal split of D2/D6).
 */
export function describeCheckoutOutcome(
  state: CheckoutUiState,
  catalog: CartCatalog,
): string | null {
  if (state.phase !== 'settled') return null;
  if (state.outcome.status === 'unavailable') return state.outcome.reason;
  if (state.outcome.status === 'rejected') {
    return `Algunos productos ya no estan disponibles: ${describeRejectedLines(state.outcome.lines, catalog)}.`;
  }
  return 'Redirigiendo al checkout…';
}

/** `redirect` is on its way out of the page, not a failure a Reintentar label should ever describe. */
export function isCheckoutFailure(state: CheckoutUiState): boolean {
  return state.phase === 'settled' && state.outcome.status !== 'redirect';
}

function describeRejectedLines(
  lines: CartLineId[],
  catalog: CartCatalog,
): string {
  const index = indexCartCatalog(catalog);
  return lines
    .map((variantId) => {
      const entry = index.get(variantId);
      return entry
        ? `${entry.product.title} / ${entry.variant.combination.join(', ')}`
        : `Variante #${variantId}`;
    })
    .join(', ');
}
