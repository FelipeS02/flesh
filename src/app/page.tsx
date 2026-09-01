import { BackgroundPlate } from "@/components/shared/background-plate";
import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { getProducts } from "@/modules/catalog";
import { DropCatalog } from "@/modules/storefront/drop-catalog";

/**
 * The landing. Async on purpose even though the mock source answers
 * synchronously: `CatalogPort` allows a promise, and the live Tiendanube
 * client will return one — awaiting here means that swap changes one module
 * instead of also reopening this file.
 *
 * The page owns the vertical rhythm, not the shell: the artboards' `Content`
 * frame is a full-height `space-between` column with 16px of horizontal
 * padding on mobile, which is why `Header` carries only its top padding and
 * `Footer` only its bottom one. `BackgroundPlate` is absolutely positioned,
 * so this wrapper's `relative` is what gives it the full page height to
 * cover.
 */
export default async function Home() {
  const products = await getProducts();

  return (
    <div className="relative flex min-h-screen flex-1 flex-col justify-between px-4 md:px-0">
      <BackgroundPlate />
      <Header />
      <main>
        <DropCatalog products={products} />
      </main>
      <Footer />
    </div>
  );
}
