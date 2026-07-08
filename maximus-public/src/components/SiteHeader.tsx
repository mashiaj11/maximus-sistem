import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { CartDrawer } from "./CartDrawer";

export function SiteHeader({
  mesa,
  unidade,
  mode,
}: {
  mesa?: string;
  unidade?: string;
  mode?: string;
}) {
  const search = {
    ...(unidade ? { unidade } : {}),
    ...(unidade ? { unit: unidade } : {}),
    ...(mesa ? { mesa } : {}),
    ...(mesa ? { table: mesa } : {}),
    ...(mode ? { mode } : {}),
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link
            to="/menu"
            search={search}
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline"
          >
            Cardápio
          </Link>
          <Link
            to="/acompanhar"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline"
          >
            Acompanhar pedido
          </Link>
          <Link
            to="/meus-pedidos"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline"
          >
            Meus pedidos
          </Link>
          <CartDrawer checkoutSearch={mesa || unidade ? search : undefined} />
        </nav>
      </div>
    </header>
  );
}
