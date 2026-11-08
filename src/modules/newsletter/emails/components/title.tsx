import type { ReactNode } from "react";
import { Heading } from "react-email";
import { emailTheme as t } from "../theme";

export function Title({ children }: { children: ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: `0 0 ${t.space.gap}px`,
        fontFamily: t.font.display,
        fontSize: t.size.title,
        lineHeight: 1.05,
        // Bold, though Kraut ships one weight: Gmail and Outlook render the
        // Helvetica fallback, where 400 read thin next to the storefront's caps.
        fontWeight: 700,
        textTransform: "uppercase",
        color: t.color.primary,
      }}
    >
      {children}
    </Heading>
  );
}
