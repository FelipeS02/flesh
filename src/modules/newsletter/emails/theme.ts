// Storefront palette, copied as literals: email clients do not resolve CSS
// variables, so the globals.css tokens cannot be referenced from here.
export const emailTheme = {
  color: {
    background: "#000000",
    foreground: "#FFFFFF",
    primary: "#DC2626",
    primaryForeground: "#FFFFFF",
    mutedForeground: "#C7C7C7",
    border: "rgba(255,255,255,0.15)",
    footer: "#0A0A0A",
    photoFallback: "#141414",
  },
  font: {
    // The web font only loads in Apple Mail and iOS Mail; Gmail and Outlook
    // strip @font-face, so the serif stack must hold the layout on its own.
    display: '"Kraut", Georgia, "Times New Roman", serif',
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
    side: 48,
    section: 32,
    gap: 16,
  },
  // Square corners only: the storefront runs at --radius: 0, so no token for it.
  width: 600,
  logo: { width: 190, height: 75 },
} as const;

// bgcolor mirrors the inline background: some clients invert inline colours in
// light mode but still honour the legacy attribute, so dark stays dark. It is
// outside React's DOM typings, hence the cast.
export const legacyBackground = (color: string) => ({ bgcolor: color }) as Record<string, string>;
