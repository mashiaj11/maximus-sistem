import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/auth/AuthProvider";
import { BootSplash } from "@/components/BootSplash";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maximus Admin" },
      { name: "description", content: "Painel operacional da Maximus Hamburgueria." },
      { property: "og:title", content: "Maximus Admin" },
      { property: "og:description", content: "Painel operacional da Maximus Hamburgueria." },
    ],
  }),
  component: Index,
});

function Index() {
  const auth = useAuth();
  if (auth.status === "loading") return <BootSplash message="Preparando sua operação..." />;
  if (auth.status === "authenticated") return <Navigate to="/admin" replace />;
  if (auth.status === "password_recovery") return <Navigate to="/redefinir-senha" replace />;
  return <Navigate to="/login" replace />;
}
