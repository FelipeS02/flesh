export type Money = { amount: number; currency: string };

// Per-currency decimal exponent. Only ARS is registered today — the storefront
// is a single-currency Tiendanube store. Deliberately NOT a silent fallback:
// Tiendanube also supports 0-decimal currencies (CLP, JPY), so assuming 2
// decimals for an unregistered currency would silently corrupt amounts.
const CURRENCY_EXPONENTS: Record<string, number> = {
  ARS: 2,
};

const DEFAULT_CURRENCY = "ARS";

/**
 * Returns the number of decimal digits a currency's minor unit uses, e.g. 2
 * for ARS ($X.XX). Throws for any currency not explicitly registered above,
 * rather than defaulting silently — the assertion IS the safety net.
 */
export function currencyExponent(currency: string = DEFAULT_CURRENCY): number {
  const exponent = CURRENCY_EXPONENTS[currency];
  if (exponent === undefined) {
    throw new Error(
      `Unknown currency "${currency}" — no decimal exponent registered in ` +
        `CURRENCY_EXPONENTS. Money parsing must not silently assume 2 ` +
        `decimals for a currency it does not recognise (Tiendanube also ` +
        `serves 0-decimal currencies such as CLP/JPY).`,
    );
  }
  return exponent;
}

/**
 * Parses a Tiendanube wire price string (e.g. "25.00") into integer minor
 * units (2500). Deliberately hand-rolled: never `parseFloat(s) * 100`, which
 * introduces float error (`19.99 * 100 === 1998.9999999999998`). Instead,
 * split on "." and pad/truncate the fraction to the currency's exponent
 * before parsing as an integer.
 */
export function parseMoney(raw: string, currency: string = DEFAULT_CURRENCY): Money {
  const exponent = currencyExponent(currency);
  const isNegative = raw.trim().startsWith("-");
  const unsigned = isNegative ? raw.trim().slice(1) : raw.trim();
  const [integerPart, fractionPart = ""] = unsigned.split(".");
  const paddedFraction = fractionPart.padEnd(exponent, "0").slice(0, exponent);
  const digits = `${integerPart || "0"}${paddedFraction}`;
  const amount = Number.parseInt(digits, 10) * (isNegative ? -1 : 1);

  return { amount, currency };
}

/**
 * Hand-rolled formatter — deliberately NOT `Intl.NumberFormat`. `PriceBlock`
 * is a client component whose price depends on selection state, so it
 * renders on both server and client; ICU data can differ across Node and
 * browser engines, which is a real hydration-mismatch source for a value
 * this visible. A single locale/currency makes a ~10-line deterministic
 * formatter a better fit than a locale-aware library.
 *
 * Format: dot as thousands separator, comma as decimal separator, e.g.
 * `formatMoney({ amount: 2_500_000, currency: "ARS" })` -> "$25.000,00".
 */
export function formatMoney({ amount, currency }: Money): string {
  const exponent = currencyExponent(currency);
  const divisor = 10 ** exponent;
  const absoluteAmount = Math.abs(amount);
  const integerUnits = Math.trunc(absoluteAmount / divisor);
  const fractionUnits = absoluteAmount % divisor;

  const sign = amount < 0 ? "-" : "";
  const groupedInteger = integerUnits
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = fractionUnits.toString().padStart(exponent, "0");

  return `${sign}$${groupedInteger},${fraction}`;
}
