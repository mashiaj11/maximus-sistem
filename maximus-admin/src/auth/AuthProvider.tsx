/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type UserRole =
  | "super_admin"
  | "owner"
  | "unit_manager"
  | "cashier"
  | "kitchen"
  | "bar"
  | "delivery_manager"
  | "viewer";

type UserProfile = {
  id: string;
  fullName: string;
  role: UserRole;
  active: boolean;
};

type UserUnitAccess = {
  id: string;
  userId: string;
  unitId: string;
  isPrimary: boolean;
  active: boolean;
};

type AuthUnit = {
  id: string;
  name: string;
  active: boolean;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "blocked" | "password_recovery";

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  unitAccess: UserUnitAccess[];
  units: AuthUnit[];
  allowedUnitIds: string[];
  primaryUnitId: string | null;
  isSuperAdmin: boolean;
  isPasswordRecovery: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuthContext: () => Promise<void>;
};

type UserProfileRow = {
  id: string;
  full_name: string;
  role: UserRole;
  active: boolean;
};

type UserUnitAccessRow = {
  id: string;
  user_id: string;
  unit_id: string;
  is_primary: boolean;
  active: boolean;
};

type AuthUnitRow = {
  id: string;
  name: string;
  active: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    active: row.active,
  };
}

function mapUnitAccess(row: UserUnitAccessRow): UserUnitAccess {
  return {
    id: row.id,
    userId: row.user_id,
    unitId: row.unit_id,
    isPrimary: row.is_primary,
    active: row.active,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unitAccess, setUnitAccess] = useState<UserUnitAccess[]>([]);
  const [units, setUnits] = useState<AuthUnit[]>([]);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRecoveryActiveRef = useRef(false);

  const clearAuthenticatedState = useCallback(
    (nextStatus: AuthStatus, nextError: string | null) => {
      setSession(null);
      setProfile(null);
      setUnitAccess([]);
      setUnits([]);
      passwordRecoveryActiveRef.current = false;
      setIsPasswordRecovery(false);
      setError(nextError);
      setStatus(nextStatus);
    },
    [],
  );

  const loadAuthorization = useCallback(
    async (nextSession: Session | null) => {
      if (passwordRecoveryActiveRef.current) {
        return;
      }

      if (!isSupabaseConfigured) {
        clearAuthenticatedState("blocked", "Supabase não configurado.");
        return;
      }

      if (!nextSession?.user) {
        clearAuthenticatedState("unauthenticated", null);
        return;
      }

      const client = getSupabaseClient();
      setStatus("loading");
      setSession(nextSession);
      passwordRecoveryActiveRef.current = false;
      setIsPasswordRecovery(false);
      setError(null);

      const { data: profileRow, error: profileError } = await client
        .from("user_profiles")
        .select("id, full_name, role, active")
        .eq("id", nextSession.user.id)
        .maybeSingle<UserProfileRow>();

      if (passwordRecoveryActiveRef.current) {
        return;
      }

      if (profileError) {
        clearAuthenticatedState("blocked", profileError.message);
        return;
      }

      if (!profileRow) {
        clearAuthenticatedState("blocked", "Perfil de usuário não encontrado.");
        return;
      }

      const nextProfile = mapProfile(profileRow);
      if (!nextProfile.active) {
        clearAuthenticatedState("blocked", "Usuário inativo.");
        return;
      }

      const { data: accessRows, error: accessError } = await client
        .from("user_unit_access")
        .select("id, user_id, unit_id, is_primary, active")
        .eq("user_id", nextSession.user.id)
        .eq("active", true)
        .returns<UserUnitAccessRow[]>();

      if (passwordRecoveryActiveRef.current) {
        return;
      }

      if (accessError) {
        clearAuthenticatedState("blocked", accessError.message);
        return;
      }

      const nextUnitAccess = (accessRows ?? []).map(mapUnitAccess);
      const relatedUnitIds = nextUnitAccess.map((access) => access.unitId);
      const { data: unitRows, error: unitsError } =
        nextProfile.role === "super_admin"
          ? await client.from("units").select("id, name, active").eq("active", true)
          : relatedUnitIds.length > 0
            ? await client
                .from("units")
                .select("id, name, active")
                .in("id", relatedUnitIds)
                .eq("active", true)
                .returns<AuthUnitRow[]>()
            : { data: [] as AuthUnitRow[], error: null };

      if (passwordRecoveryActiveRef.current) {
        return;
      }

      if (unitsError) {
        clearAuthenticatedState("blocked", unitsError.message);
        return;
      }

      const nextUnits = (unitRows ?? []) as AuthUnitRow[];
      const activeUnitIds = new Set(nextUnits.map((unit) => unit.id));
      const activeUnitAccess = nextUnitAccess.filter((access) => activeUnitIds.has(access.unitId));

      if (nextProfile.role !== "super_admin" && activeUnitAccess.length === 0) {
        clearAuthenticatedState("blocked", "Usuário sem unidade ativa vinculada.");
        return;
      }

      setSession(nextSession);
      setProfile(nextProfile);
      setUnitAccess(nextProfile.role === "super_admin" ? nextUnitAccess : activeUnitAccess);
      setUnits(nextUnits);
      passwordRecoveryActiveRef.current = false;
      setIsPasswordRecovery(false);
      setError(null);
      setStatus("authenticated");
    },
    [clearAuthenticatedState],
  );

  const refreshAuthContext = useCallback(async () => {
    if (!isSupabaseConfigured) {
      clearAuthenticatedState("blocked", "Supabase não configurado.");
      return;
    }

    const { data, error: sessionError } = await getSupabaseClient().auth.getSession();
    if (sessionError) {
      clearAuthenticatedState("unauthenticated", sessionError.message);
      return;
    }

    await loadAuthorization(data.session);
  }, [clearAuthenticatedState, loadAuthorization]);

  useEffect(() => {
    let active = true;
    const client = isSupabaseConfigured ? getSupabaseClient() : null;

    if (!client) {
      clearAuthenticatedState("blocked", "Supabase não configurado.");
      return;
    }

    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      if (event === "SIGNED_OUT") {
        clearAuthenticatedState("unauthenticated", null);
        return;
      }

      if (event === "PASSWORD_RECOVERY" && nextSession?.user) {
        passwordRecoveryActiveRef.current = true;
        setSession(nextSession);
        setProfile(null);
        setUnitAccess([]);
        setUnits([]);
        setIsPasswordRecovery(true);
        setError(null);
        setStatus("password_recovery");
        return;
      }

      if (passwordRecoveryActiveRef.current) {
        return;
      }

      void loadAuthorization(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [clearAuthenticatedState, loadAuthorization]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error("Supabase não configurado.");
    }

    const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) throw signInError;
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { error: signOutError } = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
    clearAuthenticatedState("unauthenticated", null);
  }, [clearAuthenticatedState]);

  const value = useMemo<AuthContextValue>(() => {
    const allowedUnitIds = unitAccess.map((access) => access.unitId);
    return {
      status,
      session,
      user: session?.user ?? null,
      profile,
      unitAccess,
      units,
      allowedUnitIds,
      primaryUnitId:
        unitAccess.find((access) => access.isPrimary)?.unitId ?? allowedUnitIds[0] ?? null,
      isSuperAdmin: profile?.role === "super_admin",
      isPasswordRecovery,
      error,
      signIn,
      signOut,
      refreshAuthContext,
    };
  }, [
    error,
    isPasswordRecovery,
    profile,
    refreshAuthContext,
    session,
    signIn,
    signOut,
    status,
    unitAccess,
    units,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
