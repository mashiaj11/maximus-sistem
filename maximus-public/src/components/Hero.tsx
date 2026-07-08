import type { CSSProperties, MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const heroMotionStyle = {
  "--hero-x": "0px",
  "--hero-y": "0px",
  "--hero-scale": "1",
} as CSSProperties;

export function Hero({ orderLink }: { orderLink: string }) {
  function handlePointerMove(event: MouseEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    event.currentTarget.style.setProperty("--hero-x", `${x * 18}px`);
    event.currentTarget.style.setProperty("--hero-y", `${y * 14}px`);
  }

  function handlePointerEnter(event: MouseEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--hero-scale", "1.035");
  }

  function handlePointerLeave(event: MouseEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--hero-x", "0px");
    event.currentTarget.style.setProperty("--hero-y", "0px");
    event.currentTarget.style.setProperty("--hero-scale", "1");
  }

  return (
    <section
      className="relative isolate overflow-hidden border-b border-border bg-[#050302]"
      style={heroMotionStyle}
      onMouseEnter={handlePointerEnter}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      <div
        className="pointer-events-none absolute inset-0 scale-[1.03] bg-[url('/hero-maximus-bg.png')] bg-cover bg-[65%_center] transition-transform duration-500 ease-out sm:bg-[68%_center] lg:bg-center"
        style={{
          transform:
            "translate3d(calc(var(--hero-x) * .28), calc(var(--hero-y) * .18), 0) scale(var(--hero-scale))",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_50%,rgba(255,61,0,0.11),transparent_32%),linear-gradient(90deg,rgba(5,3,2,0.98)_0%,rgba(5,3,2,0.9)_30%,rgba(5,3,2,0.52)_52%,rgba(5,3,2,0.14)_76%,rgba(5,3,2,0.22)_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.68)_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[linear-gradient(180deg,rgba(0,0,0,0.38),transparent_22%,transparent_76%,rgba(0,0,0,0.55))]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-88px)] max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[0.78fr_1.22fr] lg:gap-0 lg:py-10">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <p className="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.22em] text-primary shadow-[0_0_34px_rgba(255,61,0,0.08)]">
            Hamburgueria & Churrasco
          </p>

          <h1 className="mt-7 max-w-[10ch] text-5xl font-extrabold uppercase leading-[0.9] tracking-[-0.065em] text-foreground sm:text-6xl lg:text-7xl xl:text-[5.65rem]">
            Sabor de verdade,
            <br />
            do jeito Maximus.
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/72 sm:text-lg lg:text-xl">
            Hambúrgueres artesanais, churrasco na brasa, petiscos especiais e bebidas geladas.
          </p>

          <div className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row lg:justify-start">
            <Button
              asChild
              size="lg"
              className="h-14 w-full bg-primary px-8 text-sm font-extrabold uppercase tracking-[0.08em] text-primary-foreground shadow-[0_18px_40px_rgba(255,61,0,0.24)] hover:bg-primary/90 sm:w-auto"
            >
              <Link to={orderLink}>FAZER PEDIDO AGORA</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 w-full border-white/24 bg-white/5 px-8 text-sm font-extrabold uppercase tracking-[0.08em] text-foreground hover:bg-white/10 sm:w-auto"
            >
              <Link to="/onde-estamos">ONDE ESTAMOS</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
