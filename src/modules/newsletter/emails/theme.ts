// Storefront palette, copied as literals: email clients do not resolve CSS
// variables, so the globals.css tokens cannot be referenced from here.
export const emailTheme = {
  color: {
    background: "#000000",
    foreground: "#FFFFFF",
    primary: "#DC2626",
    primaryForeground: "#FFFFFF",
    // White, not the storefront's #C7C7C7: Gmail for iOS inverts text in dark
    // mode, and the blend trick that restores it (see GmailDarkSafe) only
    // brings pure white back. A grey would arrive as a muddy mid-tone.
    mutedForeground: "#FFFFFF",
    border: "rgba(255,255,255,0.15)",
    footer: "#0A0A0A",
    photoFallback: "#141414",
  },
  font: {
    // The web font only loads in Apple Mail and iOS Mail; Gmail and Outlook
    // strip @font-face, so the fallback stack must hold the layout on its own.
    // Sans rather than serif: a bold grotesque reads closer to Kraut's heavy
    // caps than Times does, so the Gmail render keeps the brand's weight.
    display: '"Kraut", "Helvetica Neue", Helvetica, Arial, sans-serif',
    body: '"Courier Prime", "Courier New", Courier, monospace',
  },
  size: {
    eyebrow: 12,
    body: 15,
    title: 44,
    button: 22,
    price: 28,
    small: 11,
  },
  space: {
    // No side gutter of our own: Gmail and Apple Mail already inset the message,
    // and a second 48px on a phone squeezed the content to two thirds of it.
    side: 8,
    section: 32,
    gap: 16,
  },
  // Square corners only: the storefront runs at --radius: 0, so no token for it.
  width: 600,
  // The asset's 190:75 ratio, scaled down: at 190px it filled half a phone screen.
  logo: { width: 120, height: 47 },
} as const;

// bgcolor mirrors the inline background: some clients invert inline colours in
// light mode but still honour the legacy attribute, so dark stays dark. It is
// outside React's DOM typings, hence the cast.
export const legacyBackground = (color: string) => ({ bgcolor: color }) as Record<string, string>;

// The same colour twice as a gradient: Gmail for iOS inverts background-color
// in dark mode but leaves background-image alone, so this keeps black black.
export const solidBackground = (color: string) => ({
  backgroundColor: color,
  backgroundImage: `linear-gradient(${color}, ${color})`,
});
