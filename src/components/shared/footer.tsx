import { Nav } from "@/components/shared/nav";

/**
 * Site footer. Sync server component — wraps Nav, adds only the bottom
 * spacing called out in the artboards.
 */
export function Footer() {
  return (
    <footer className="relative left-1/2 w-screen -translate-x-1/2 md:pb-6.5 md:left-auto md:w-auto md:translate-x-0">
      <Nav />
    </footer>
  );
}
