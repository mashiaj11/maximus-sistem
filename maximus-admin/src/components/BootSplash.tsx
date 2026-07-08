const DEFAULT_LOGO_URL = "/branding/maximus-logo.png";

type BootSplashProps = {
  message?: string;
  logoUrl?: string;
};

export function BootSplash({
  message = "Iniciando Maximus...",
  logoUrl = DEFAULT_LOGO_URL,
}: BootSplashProps) {
  return (
    <main className="admin-root admin-root--dark flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 font-sora text-foreground">
      <section className="flex flex-col items-center text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/20 bg-primary/10 shadow-[0_0_48px_rgba(255,61,0,0.16)]" />
          <img
            src={logoUrl}
            alt="Maximus Hamburgueria"
            className="relative h-20 w-20 object-contain"
          />
        </div>
        <p className="mt-7 text-sm font-extrabold uppercase tracking-[0.18em] text-primary">
          Maximus Sistema
        </p>
        <h1 className="mt-3 text-xl font-black tracking-tight text-foreground sm:text-2xl">
          {message}
        </h1>
        <div
          aria-hidden="true"
          className="mt-6 h-1.5 w-44 overflow-hidden rounded-full bg-white/10"
        >
          <div className="h-full w-1/2 animate-[maximus-boot_1.15s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      </section>
    </main>
  );
}
