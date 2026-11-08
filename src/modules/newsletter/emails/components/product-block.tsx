import { Column, Img, Row, Section, Text } from "react-email";
import { emailTheme as t, legacyBackground } from "../theme";

type ProductBlockProps = {
  baseUrl: string;
  imageUrl: string;
  /** The image's alt text only: each template's title already prints the name. */
  name: string;
  price: string;
};

// The 600px container minus the template's side padding and this block's 1px border.
const FRAME_WIDTH = t.width - 2 * t.space.side - 2;
// The garment covers the floor's empty centre; any wider and it lands on the
// plates and the chain the backdrop keeps around its edges.
const GARMENT_SHARE = 0.64;
const GARMENT_WIDTH = Math.round(FRAME_WIDTH * GARMENT_SHARE);
// Fixed pixels, so on a phone they are a far larger share of the frame than on
// desktop: 150 made the floor taller than the screen in Gmail for iOS.
const FLOOR_PADDING = 48;

export function ProductBlock({ baseUrl, imageUrl, name, price }: ProductBlockProps) {
  return (
    <Section
      style={{
        margin: `${t.space.gap}px 0`,
        border: `1px solid ${t.color.border}`,
      }}
    >
      {/* The floor is a CSS background under the transparent cutout, not a second
          <img> overlapped on it: Gmail strips position and negative margins, so
          an overlap would stack the two images instead. Where the background is
          ignored (Outlook for Windows) or images are blocked, the fallback colour
          shows, which is how this block looked before the floor existed. */}
      <Row>
        <Column
          align="center"
          {...legacyBackground(t.color.photoFallback)}
          style={{
            // One shorthand, not background-size: Gmail's apps on non-Google
            // accounts drop the standalone property but honour it in here.
            background: `${t.color.photoFallback} url('${baseUrl}/email/gym-floor.jpg') center / cover no-repeat`,
            padding: `${FLOOR_PADDING}px 0`,
          }}
        >
          <Img
            src={imageUrl}
            alt={name}
            // Pixel attribute for Outlook for Windows, which reads a percentage
            // against the file's own width and would push a 1024px cutout past
            // the frame; every other client takes the CSS width.
            width={GARMENT_WIDTH}
            style={{
              display: "block",
              margin: "0 auto",
              width: `${GARMENT_SHARE * 100}%`,
              height: "auto",
            }}
          />
        </Column>
      </Row>
      <Section style={{ padding: t.space.gap }}>
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
