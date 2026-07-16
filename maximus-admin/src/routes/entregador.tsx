import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdminProvider, useAdmin } from "@/admin/store";

const logoUrl = "/branding/maximus-logo-transparent.png";

export const Route = createFileRoute("/entregador")({
  component: EntregadorRoute,
});

function EntregadorRoute() {
  return (
    <AdminProvider>
      <DriverLogin />
    </AdminProvider>
  );
}

function DriverLogin() {
  const { validateDriverLogin } = useAdmin();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="admin-root flex min-h-screen items-center justify-center bg-background p-4 font-sora">
      <section className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <img src={logoUrl} alt="Maximus" className="mx-auto h-16 w-16 object-contain" />
        <h1 className="mt-4 text-center text-2xl font-black">Painel do entregador</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Entre com usuário e senha cadastrados pelo admin.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const driverId = await validateDriverLogin(username, pin);
            if (!driverId) {
              setError("Usuário ou senha inválidos, ou entregador inativo.");
              return;
            }
            window.localStorage.setItem("maximus-driver-session", driverId);
            window.location.href = `/entrega/${driverId}`;
          }}
        >
          <input
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setError("");
            }}
            className="w-full rounded-lg border border-input bg-background px-3 py-3 text-center text-lg font-black"
            placeholder="Usuário"
          />
          <input
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, ""));
              setError("");
            }}
            inputMode="numeric"
            type="password"
            className="w-full rounded-lg border border-input bg-background px-3 py-3 text-center text-lg font-black tracking-widest"
            placeholder="Senha/PIN"
          />
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <button className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground">
            Entrar
          </button>
        </form>
        <Link
          to="/admin"
          className="mt-4 block text-center text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          Voltar ao admin
        </Link>
      </section>
    </main>
  );
}
