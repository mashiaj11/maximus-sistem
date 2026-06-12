import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { PageHeader } from "@/admin/components/AdminLayout";
import type { AdminUser, AdminUserRole } from "@/admin/data/types";
import { useAdmin } from "@/admin/store";

export const Route = createFileRoute("/admin/usuarios")({
  component: UsuariosPage,
});

const ROLE_LABELS: Record<AdminUserRole, string> = {
  gestor: "Gestor",
  atendente: "Atendente",
  cozinha: "Cozinha",
  entregador: "Entregador",
};

const ROLES = Object.keys(ROLE_LABELS) as AdminUserRole[];

function UsuariosPage() {
  const { users, selectedUnit, addUser, updateUser, toggleUser } = useAdmin();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<AdminUserRole>("atendente");
  const [editing, setEditing] = useState<AdminUser | null>(null);

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle={`Equipe administrativa · ${selectedUnit?.name ?? "Unidade"}`}
      />

      <form
        className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_220px_160px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          addUser({ name, contact, role });
          setName("");
          setContact("");
          setRole("atendente");
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome do usuário"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <input
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="Telefone ou email"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as AdminUserRole)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </select>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-extrabold text-primary-foreground">
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Telefone ou email</th>
              <th className="px-4 py-3 font-medium">Função</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isEditing = editing?.id === user.id;
              return (
                <tr key={user.id} className="border-t border-border bg-background">
                  <td className="px-4 py-3 font-semibold">
                    {isEditing ? (
                      <input
                        value={editing.name}
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      />
                    ) : (
                      user.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {isEditing ? (
                      <input
                        value={editing.contact}
                        onChange={(event) =>
                          setEditing({ ...editing, contact: event.target.value })
                        }
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      />
                    ) : (
                      user.contact
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={editing.role}
                        onChange={(event) =>
                          setEditing({ ...editing, role: event.target.value as AdminUserRole })
                        }
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      >
                        {ROLES.map((option) => (
                          <option key={option} value={option}>
                            {ROLE_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                        {ROLE_LABELS[user.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleUser(user.id)}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                        user.active
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {user.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            updateUser(user.id, {
                              name: editing.name,
                              contact: editing.contact,
                              role: editing.role,
                            });
                            setEditing(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded-md bg-secondary px-3 py-1.5 text-xs font-bold"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditing(user)}
                        className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-bold hover:bg-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
