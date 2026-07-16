import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const logoUrl = "/branding/maximus-logo-transparent.png";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha · Maximus Admin" },
      { name: "description", content: "Redefinição de senha do acesso administrativo Maximus." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isInvalidRecovery = auth.status !== "loading" && !auth.isPasswordRecovery && !success;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setFormError("As senhas informadas não são iguais.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured || !auth.isPasswordRecovery) {
        throw new Error("invalid_recovery");
      }

      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      await auth.signOut();
      await navigate({ to: "/login", replace: true });
    } catch {
      setFormError("Este link de recuperação é inválido ou expirou.");
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
            <h1 className="mt-1 text-2xl font-black tracking-tight">Redefinir senha</h1>
          </div>
        </div>

        {auth.status === "loading" ? (
          <div className="mt-8 rounded-lg border border-border bg-background px-3 py-4 text-center">
            <p className="text-sm font-semibold">Validando link de recuperação...</p>
          </div>
        ) : success ? (
          <div className="mt-8 rounded-lg border border-primary/30 bg-primary/10 px-3 py-3 text-sm font-semibold text-foreground">
            Senha redefinida com sucesso. Entre novamente com sua nova senha.
          </div>
        ) : isInvalidRecovery ? (
          <div className="mt-8 space-y-6">
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm font-semibold text-destructive">
              Este link de recuperação é inválido ou expirou.
            </p>
            <Link
              to="/esqueci-minha-senha"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Solicitar novo link
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-semibold text-foreground" htmlFor="password">
                Nova senha
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary">
                <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
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

            <div>
              <label className="text-sm font-semibold text-foreground" htmlFor="confirmation">
                Confirmar senha
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-primary">
                <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                <input
                  id="confirmation"
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmation((current) => !current)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={showConfirmation ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {formError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
