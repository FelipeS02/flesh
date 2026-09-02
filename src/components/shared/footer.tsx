import { Nav } from "@/components/shared/nav";

/**
 * Site footer. Sync server component — wraps Nav, adds only the bottom
 * spacing called out in the artboards.
 */
export function Footer() {
  return (
    <footer className="pb-6.5 md:pb-10">
      <Nav />
    </footer>
  );
}
