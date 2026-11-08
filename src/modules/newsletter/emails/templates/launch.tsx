import { Section } from "react-email";
import { BodyText } from "../components/body-text";
import { CtaButton } from "../components/cta-button";
import { EmailFooter } from "../components/email-footer";
import { EmailLayout } from "../components/email-layout";
import { Eyebrow } from "../components/eyebrow";
import { ProductBlock } from "../components/product-block";
import { Title } from "../components/title";
import { emailTheme as t } from "../theme";

export function launchSubject(productName: string): string {
  return `Ya salió: ${productName}`;
}

type LaunchEmailProps = {
  baseUrl: string;
  productName: string;
  price: string;
  imageUrl: string;
  productUrl: string;
};

export default function LaunchEmail({
  baseUrl,
  productName,
  price,
  imageUrl,
  productUrl,
}: LaunchEmailProps) {
  return (
    <EmailLayout
      baseUrl={baseUrl}
      preview={`${productName} ya está a la venta.`}
      // No unsubscribe link on purpose: this is a one-off notice the shopper
      // asked for, not a subscription, so there is nothing to opt out of.
      footer={
        <EmailFooter
          baseUrl={baseUrl}
          why={`Te llegó este email porque pediste que te avisemos cuando salga ${productName}. Es el único aviso por esta prenda y no te anotamos a nada más.`}
        />
      }
    >
      <Section style={{ padding: `0 ${t.space.side}px` }}>
        <Eyebrow>NUEVO DROP</Eyebrow>
        <Title>{productName}</Title>
        <ProductBlock
          baseUrl={baseUrl}
          imageUrl={imageUrl}
          name={productName}
          price={price}
        />
        <CtaButton href={productUrl}>NO DUERMAS</CtaButton>
        <BodyText>3 Y 6 CUOTAS † 10%OFF TRANSFERENCIAS</BodyText>
      </Section>
    </EmailLayout>
  );
}

LaunchEmail.PreviewProps = {
  baseUrl: "http://localhost:3000",
  productName: "Remera Oversize",
  price: "$ 28.500",
  // A real catalogue cover: the transparent cutout is what sits on the floor.
  imageUrl:
    "https://dcdn-us.mitiendanube.com/stores/007/556/699/products/mesa-de-trabajo-1-4-c6d8c60ce377cb164217913292534958-1024-1024.png",
  productUrl: "http://localhost:3000/producto/remera-oversize",
} satisfies LaunchEmailProps;
