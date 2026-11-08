import type { ReactNode } from "react";
import { Text } from "react-email";
import { emailTheme as t } from "../theme";
import { GmailDarkSafe } from "./gmail-dark-safe";

export function BodyText({ children }: { children: ReactNode }) {
  return (
    <GmailDarkSafe>
      <Text
        style={{
          margin: `0 0 ${t.space.gap}px`,
          fontFamily: t.font.body,
          fontSize: t.size.body,
          lineHeight: 1.6,
          color: t.color.foreground,
        }}
      >
        {children}
      </Text>
    </GmailDarkSafe>
  );
}
