const DEFAULT_LOGO_URL = "/branding/maximus-logo-transparent.png";

type BootSplashProps = {
  message?: string;
  logoUrl?: string;
};

export function BootSplash({
  message = "Iniciando Maximus...",
  logoUrl = DEFAULT_LOGO_URL,
}: BootSplashProps) {
  return (
    <main className="admin-root admin-root--dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] px-6 font-sora text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,61,0,0.16),transparent_30%),linear-gradient(135deg,#090909_0%,#111_48%,#080808_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10 animate-pulse" />
      <section className="relative z-10 flex flex-col items-center text-center">
        <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
          <div className="absolute inset-6 rounded-full bg-primary/10 blur-2xl" />
          <div className="absolute inset-2 rounded-full border border-primary/15" />
          <img
            src={logoUrl}
            alt="Maximus Hamburgueria"
            className="relative h-full w-full object-contain drop-shadow-[0_0_28px_rgba(255,61,0,0.38)]"
          />
        </div>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.32em] text-primary">Maximus</p>
        <h1 className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">{message}</h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
          Sistema operacional da hamburgueria
        </p>
        <div aria-hidden="true" className="mt-7 h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-[maximus-boot_1.15s_ease-in-out_infinite] rounded-full bg-primary shadow-[0_0_14px_rgba(255,61,0,0.8)]" />
        </div>
      </section>
    </main>
  );
}
