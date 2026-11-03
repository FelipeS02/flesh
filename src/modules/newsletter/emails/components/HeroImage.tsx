import { Img, Section } from "react-email";
import { emailTheme as t } from "../theme";

type HeroImageProps = { src: string; alt: string };

// Full width of the container, edge to edge: the layout pads its children, so
// this sits outside that padding. The fallback colour holds the space while the
// photo loads or when the client blocks remote images.
export function HeroImage({ src, alt }: HeroImageProps) {
  return (
    <Section style={{ margin: `${t.space.gap}px 0 0` }}>
      <Img
        src={src}
        alt={alt}
        width="100%"
        style={{ display: "block", width: "100%", height: "auto", backgroundColor: t.color.photoFallback }}
      />
    </Section>
  );
}
