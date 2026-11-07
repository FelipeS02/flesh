import { Section } from "react-email";
import { BodyText } from "../components/body-text";
import { CtaButton } from "../components/cta-button";
import { EmailFooter } from "../components/email-footer";
import { EmailLayout } from "../components/email-layout";
import { Eyebrow } from "../components/eyebrow";
import { ProductBlock } from "../components/product-block";
import { Title } from "../components/title";
import { emailTheme as t } from "../theme";

export function restockSubject(productName: string, variantLabel: string): string {
  return `Volvió tu talle: ${productName} (${variantLabel})`;
}

type RestockEmailProps = {
  baseUrl: string;
  productName: string;
  variantLabel: string;
  price: string;
  imageUrl: string;
  productUrl: string;
};

export default function RestockEmail({
  baseUrl,
  productName,
  variantLabel,
  price,
  imageUrl,
  productUrl,
}: RestockEmailProps) {
  return (
    <EmailLayout
      baseUrl={baseUrl}
      preview={`Volvió ${productName} en ${variantLabel}.`}
      // No unsubscribe link on purpose: this is a one-off notice the shopper
      // asked for, not a subscription, so there is nothing to opt out of.
      footer={
        <EmailFooter
          baseUrl={baseUrl}
          why={`Te llegó este email porque pediste que te avisemos cuando vuelva ${productName} en ${variantLabel}. Es el único aviso por esta prenda y no te anotamos a nada más.`}
        />
      }
    >
      <Section style={{ padding: `0 ${t.space.side}px` }}>
        <Eyebrow>AVISO DE RESTOCK</Eyebrow>
        <Title>Volvió tu talle</Title>
        <ProductBlock
          imageUrl={imageUrl}
          name={productName}
          variantLabel={variantLabel}
          price={price}
        />
        <CtaButton href={productUrl}>NO DUERMAS</CtaButton>
        <BodyText>
          Entraron pocas unidades y no te la reservamos: se la lleva el primero que paga.
        </BodyText>
      </Section>
    </EmailLayout>
  );
}

RestockEmail.PreviewProps = {
  baseUrl: "http://localhost:3000",
  productName: "Remera Oversize",
  variantLabel: "Negro / M",
  price: "$ 28.500",
  imageUrl: "http://localhost:3000/email/logotype.png",
  productUrl: "http://localhost:3000/productos/remera-oversize",
} satisfies RestockEmailProps;
