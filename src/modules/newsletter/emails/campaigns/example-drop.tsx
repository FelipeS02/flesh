import { Section } from "react-email";
import { BodyText } from "../components/BodyText";
import { CtaButton } from "../components/CtaButton";
import { EmailFooter } from "../components/EmailFooter";
import { EmailLayout } from "../components/EmailLayout";
import { Eyebrow } from "../components/Eyebrow";
import { HeroImage } from "../components/HeroImage";
import { ProductGrid } from "../components/ProductGrid";
import { Title } from "../components/Title";
import { emailTheme as t } from "../theme";

// A campaign is one disposable file: copy this one, change the copy and the
// products, send it with `pnpm campaign <slug>`, and delete it afterwards (git
// history keeps it). Nothing else imports a campaign, so removing one breaks
// nothing.
export const subject = "Nuevo drop: Stronger than death";
export const previewText = "Dos remeras, una tirada corta. El viernes a las 20 h.";

type ExampleDropProps = { baseUrl: string; unsubscribeUrl: string };

export default function ExampleDrop({ baseUrl, unsubscribeUrl }: ExampleDropProps) {
  // Photos are served from the live site, so a real campaign must be sent from
  // an origin that already hosts them (deployed `public/`, or SITE_URL).
  const products = [
    { name: "Remera Oversize", price: "$24.300", imageUrl: `${baseUrl}/products/1.png`, href: `${baseUrl}/producto/remera-oversize` },
    { name: "Remera Boxy", price: "$24.300", imageUrl: `${baseUrl}/products/2.png`, href: `${baseUrl}/producto/remera-boxy` },
  ];

  return (
    <EmailLayout
      baseUrl={baseUrl}
      preview={previewText}
      footer={
        <EmailFooter
          baseUrl={baseUrl}
          unsubscribeUrl={unsubscribeUrl}
          why="Te llegó este email porque te suscribiste al newsletter de FLESH en flesh.ar. Si ya no lo querés, date de baja con un click."
        />
      }
    >
      <HeroImage src={`${baseUrl}/products/3.webp`} alt="Stronger than death" />
      <Section style={{ padding: `0 ${t.space.side}px` }}>
        <Eyebrow>NUEVO DROP · VIERNES 20 H</Eyebrow>
        <Title>Stronger than death</Title>
        <BodyText>Dos remeras, una tirada corta. Cuando se terminan, no vuelven en esta versión.</BodyText>
        <ProductGrid items={products} />
        <CtaButton href={baseUrl}>Ver el drop</CtaButton>
      </Section>
    </EmailLayout>
  );
}

ExampleDrop.PreviewProps = {
  baseUrl: "http://localhost:3000",
  unsubscribeUrl: "http://localhost:3000/newsletter/baja?token=preview",
} satisfies ExampleDropProps;
