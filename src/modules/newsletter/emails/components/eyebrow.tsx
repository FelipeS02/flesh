import type { ReactNode } from "react";
import { Text } from "react-email";
import { emailTheme as t } from "../theme";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
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
  );
}
