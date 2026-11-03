import type { ReactNode } from "react";
import { Link } from "react-email";
import { emailTheme as t, legacyBackground } from "../theme";

// A table cell with bgcolor plus a text link, not an image: with remote images
// blocked (the default in several clients) the button must still read and click.
export function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ margin: `${t.space.gap}px 0` }}
    >
      <tbody>
        <tr>
          <td align="center" {...legacyBackground(t.color.primary)} style={{ backgroundColor: t.color.primary }}>
            <Link
              href={href}
              style={{
                display: "block",
                padding: "18px 24px",
                fontFamily: t.font.display,
                fontSize: t.size.button,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                textDecoration: "none",
                color: t.color.primaryForeground,
              }}
            >
              {children}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
