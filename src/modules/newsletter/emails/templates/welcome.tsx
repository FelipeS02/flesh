import { Section, Text } from "react-email";
import { BodyText } from "../components/body-text";
import { CtaButton } from "../components/cta-button";
import { EmailFooter } from "../components/email-footer";
import { EmailLayout } from "../components/email-layout";
import { Eyebrow } from "../components/eyebrow";
import { Title } from "../components/title";
import { emailTheme as t } from "../theme";

export const WELCOME_SUBJECT = "Ya sos parte de FLESH";

type WelcomeEmailProps = {
  baseUrl: string;
  unsubscribeUrl: string;
};

const PROMISES = [
  { number: "01", label: "DROPS", text: "El día que sale algo nuevo, con fotos y talles." },
  { number: "02", label: "RESTOCKS", text: "Cuando vuelve algo que se agotó." },
  { number: "03", label: "NADA MÁS", text: "Sin descuentos inventados ni cuentas regresivas." },
];

export default function WelcomeEmail({ baseUrl, unsubscribeUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout
      baseUrl={baseUrl}
      preview="Ya sos parte de FLESH."
      footer={
        <EmailFooter
          baseUrl={baseUrl}
          unsubscribeUrl={unsubscribeUrl}
          why="Te llegó este email porque te suscribiste al newsletter de FLESH en flesh.ar. Si no fuiste vos o ya no lo querés, date de baja con un click."
        />
      }
    >
      <Section style={{ padding: `0 ${t.space.side}px` }}>
        <Eyebrow>NEWSLETTER</Eyebrow>
        <Title>Ya sos parte</Title>
        <BodyText>
          Gracias por anotarte. Desde ahora te escribimos cuando pase algo que valga la pena, y solo
          entonces.
        </BodyText>
        {PROMISES.map((promise) => (
          <Section
            key={promise.number}
            style={{ borderTop: `1px solid ${t.color.border}`, padding: "14px 0" }}
          >
            <Text
              style={{
                margin: 0,
                fontFamily: t.font.body,
                fontSize: t.size.eyebrow,
                letterSpacing: "0.2em",
                color: t.color.primary,
              }}
            >
              {promise.number} {promise.label}
            </Text>
            <Text
              style={{
                margin: "4px 0 0",
                fontFamily: t.font.body,
                fontSize: t.size.body,
                color: t.color.foreground,
              }}
            >
              {promise.text}
            </Text>
          </Section>
        ))}
        <CtaButton href={baseUrl}>Ver la tienda</CtaButton>
      </Section>
    </EmailLayout>
  );
}

WelcomeEmail.PreviewProps = {
  baseUrl: "http://localhost:3000",
  unsubscribeUrl: "http://localhost:3000/newsletter/baja?t=preview",
} satisfies WelcomeEmailProps;
