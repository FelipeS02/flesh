import type { ReactNode } from "react";
import { Body, Container, Font, Head, Html, Img, Preview, Section } from "react-email";
import { emailTheme as t, legacyBackground } from "../theme";

type EmailLayoutProps = {
  baseUrl: string;
  preview: string;
  footer: ReactNode;
  children: ReactNode;
};

export function EmailLayout({ baseUrl, preview, footer, children }: EmailLayoutProps) {
  return (
    <Html lang="es">
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        <Font
          fontFamily="Courier Prime"
          fallbackFontFamily="monospace"
          webFont={{
            url: "https://fonts.gstatic.com/s/courierprime/v9/u-450q2lgwslOqpF_6gQ8kELWwZjW-_-tvg.woff2",
            format: "woff2",
          }}
        />
        {/* A copy of src/app/fonts/kraut.woff2: next/font serves that one under a
            content-hashed path, and a mail needs a URL that stays put after it
            is sent. Replace both files together when the font changes. */}
        <Font
          fontFamily="Kraut"
          fallbackFontFamily="serif"
          webFont={{ url: `${baseUrl}/email/kraut.woff2`, format: "woff2" }}
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        {...legacyBackground(t.color.background)}
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: t.color.background,
          color: t.color.foreground,
          fontFamily: t.font.body,
        }}
      >
        <Container
          {...legacyBackground(t.color.background)}
          style={{
            width: "100%",
            maxWidth: t.width,
            margin: "0 auto",
            backgroundColor: t.color.background,
          }}
        >
          <Section style={{ padding: `${t.space.section}px ${t.space.side}px 0`, textAlign: "center" }}>
            <Img
              src={`${baseUrl}/email/logotype.png`}
              alt="FLESH"
              width={t.logo.width}
              height={t.logo.height}
              style={{ display: "block", margin: "0 auto" }}
            />
          </Section>
          {children}
          {footer}
        </Container>
      </Body>
    </Html>
  );
}
