import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";

const logoUrl = "/branding/maximus-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login · Maximus Admin" },
      { name: "description", content: "Acesso administrativo Maximus." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Login,
});

function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (auth.status === "authenticated" && !auth.isPasswordRecovery) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await auth.signIn(email.trim(), password);
      await auth.refreshAuthContext();
      await navigate({ to: "/admin", replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="admin-root admin-root--dark flex min-h-screen items-center justify-center px-4 py-8 font-sora">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="Maximus Hamburgueria" className="h-14 w-14 object-contain" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Maximus Admin
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Acesso administrativo</h1>
          </div>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-semibold text-foreground" htmlFor="email">
              E-mail
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground" htmlFor="password">
              Senha
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary">
              <LockKeyhole className="h-4 w-4 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {(submitError || auth.error) && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              {submitError ?? auth.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || auth.status === "loading"}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting || auth.status === "loading" ? "Validando..." : "Entrar"}
          </button>

          <div className="text-center">
            <Link
              to="/esqueci-minha-senha"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
