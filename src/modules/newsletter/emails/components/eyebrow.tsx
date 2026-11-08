import type { ReactNode } from "react";
import { Text } from "react-email";
import { emailTheme as t } from "../theme";
import { GmailDarkSafe } from "./gmail-dark-safe";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <GmailDarkSafe>
      <Text
        style={{
          margin: `${t.space.section}px 0 8px`,
          fontFamily: t.font.body,
          fontSize: t.size.eyebrow,
          letterSpacing: "0.2em",
          color: t.color.mutedForeground,
        }}
      >
        {children}
      </Text>
    </GmailDarkSafe>
  );
}
