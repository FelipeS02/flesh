import { Img, Section, Text } from "react-email";
import { emailTheme as t } from "../theme";

type ProductBlockProps = {
  imageUrl: string;
  name: string;
  variantLabel: string;
  price: string;
};

export function ProductBlock({ imageUrl, name, variantLabel, price }: ProductBlockProps) {
  return (
    <Section style={{ margin: `${t.space.gap}px 0`, border: `1px solid ${t.color.border}` }}>
      {/* The fallback colour shows while the photo loads or when images are blocked. */}
      <Img
        src={imageUrl}
        alt={name}
        width="100%"
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          backgroundColor: t.color.photoFallback,
        }}
      />
      <Section style={{ padding: t.space.gap }}>
        <Text
          style={{
            margin: 0,
            fontFamily: t.font.body,
            fontSize: t.size.body,
            fontWeight: 700,
            color: t.color.foreground,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            margin: "4px 0 12px",
            fontFamily: t.font.body,
            fontSize: t.size.body,
            color: t.color.mutedForeground,
          }}
        >
          {variantLabel}
        </Text>
        <Text
          style={{
            margin: 0,
            fontFamily: t.font.display,
            fontSize: t.size.price,
            color: t.color.foreground,
          }}
        >
          {price}
        </Text>
        <Text
          style={{
            margin: 0,
            fontFamily: t.font.body,
            fontSize: t.size.small,
            letterSpacing: "0.2em",
            color: t.color.mutedForeground,
          }}
        >
          CON TRANSFERENCIA
        </Text>
      </Section>
    </Section>
  );
}
