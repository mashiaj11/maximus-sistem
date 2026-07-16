import { Link, createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const logoUrl = "/branding/maximus-logo-transparent.png";
const SENT_MESSAGE =
  "Se existir uma conta vinculada a este e-mail, enviaremos as instruções para redefinir a senha.";

export const Route = createFileRoute("/esqueci-minha-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha · Maximus Admin" },
      { name: "description", content: "Recuperação de senha do acesso administrativo Maximus." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextEmail = email.trim();

    if (!nextEmail || !/^\S+@\S+\.\S+$/.test(nextEmail)) {
      setEmailError("Informe um e-mail válido.");
      return;
    }

    setEmailError(null);
    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase não configurado.");
      }

      await getSupabaseClient().auth.resetPasswordForEmail(nextEmail, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
    } finally {
      setSent(true);
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
            <h1 className="mt-1 text-2xl font-black tracking-tight">Recuperar senha</h1>
          </div>
        </div>

        {sent ? (
          <div className="mt-8 space-y-6">
            <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-3 text-sm font-semibold text-foreground">
              {SENT_MESSAGE}
            </p>
            <Link
              to="/login"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
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
              {emailError && (
                <p className="mt-2 text-sm font-semibold text-destructive">{emailError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Enviando..." : "Enviar instruções"}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
