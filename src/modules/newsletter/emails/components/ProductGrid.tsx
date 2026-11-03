import { Column, Img, Link, Row, Section, Text } from "react-email";
import { emailTheme as t } from "../theme";

export type ProductGridItem = {
  name: string;
  /** Already formatted for the shopper, e.g. "$24.300". */
  price: string;
  imageUrl: string;
  href: string;
};

// Two cards per row. Columns are fixed at half width with a gutter built from
// padding on the inner edge: gap/margin between table cells is ignored by
// Outlook, padding is not.
export function ProductGrid({ items }: { items: ProductGridItem[] }) {
  const rows: ProductGridItem[][] = [];
  for (let start = 0; start < items.length; start += 2) rows.push(items.slice(start, start + 2));

  return (
    <Section style={{ margin: `${t.space.gap}px 0` }}>
      {rows.map((row) => (
        <Row key={row[0]!.href}>
          {row.map((item, column) => (
            <Column
              key={item.href}
              width="50%"
              style={{
                verticalAlign: "top",
                padding: column === 0 ? `0 ${t.space.gap / 2}px ${t.space.gap}px 0` : `0 0 ${t.space.gap}px ${t.space.gap / 2}px`,
              }}
            >
              <Link href={item.href} style={{ textDecoration: "none" }}>
                <Img
                  src={item.imageUrl}
                  alt={item.name}
                  width="100%"
                  style={{ display: "block", width: "100%", height: "auto", backgroundColor: t.color.photoFallback }}
                />
              </Link>
              <Text
                style={{
                  margin: "12px 0 4px",
                  fontFamily: t.font.body,
                  fontSize: t.size.body,
                  fontWeight: 700,
                  color: t.color.foreground,
                }}
              >
                {item.name}
              </Text>
              <Text
                style={{ margin: 0, fontFamily: t.font.display, fontSize: t.size.button, color: t.color.foreground }}
              >
                {item.price}
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
            </Column>
          ))}
        </Row>
      ))}
    </Section>
  );
}
