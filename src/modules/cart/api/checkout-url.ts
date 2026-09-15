/** Returns true only for credential-free HTTPS URLs on the configured host. */
export function isSafeCheckoutUrl(value: string, expectedHost?: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!expectedHost || url.host === expectedHost)
    );
  } catch {
    return false;
  }
}
