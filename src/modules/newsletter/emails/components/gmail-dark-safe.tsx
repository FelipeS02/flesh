import type { ReactNode } from "react";

/**
 * Rules for the wrapper below, scoped by `u + .body`: Gmail renders the <body>
 * as a `.body` div right after a <u>, so no other client ever matches them and
 * these layers stay inert outside Gmail.
 *
 * In Gmail's dark mode the text is inverted to near black; a difference blend
 * against black-turned-white flips it back, and the screen layer keeps the
 * result from darkening the backdrop. Only pure white survives the round trip,
 * which is why the palette's muted grey is white too.
 */
export const GMAIL_DARK_SAFE_CSS = [
  "u + .body .gmail-blend-screen { background: #000000; mix-blend-mode: screen; }",
  "u + .body .gmail-blend-difference { background: #000000; mix-blend-mode: difference; }",
].join("\n");

/** White copy on black only: a coloured fill or red text does not come back intact. */
export function GmailDarkSafe({ children }: { children: ReactNode }) {
  return (
    <div className="gmail-blend-screen">
      <div className="gmail-blend-difference">{children}</div>
    </div>
  );
}
