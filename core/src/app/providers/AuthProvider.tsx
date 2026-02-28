"use client";
import { createContext, useEffect, useRef, useState } from "react";
import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { AuthUserSession } from "@lib/auth";
import { getLastSiteFromStorage } from "@/app/components/SiteSelector";
export const authClient = createAuthClient({
  plugins: [customSessionClient()],
});
// type Provider = Params<ReturnType<typeof authClient.signIn.social>>["provider"]
type UserData = AuthUserSession | null;
export const emailSignUp = async (
  email: string,
  password: string,
  name: string,
) => {
  const result = await authClient.signUp.email({
    email: email,
    password: password,
    name: name,
    // callbackURL: "/dashboard"
  });

  if (result.error) {
    throw new Error(result.error.message || "Sign up failed");
  }
};

export const signIn = async (
  provider: "github" | "google" | "email",
  emailValues?: { email: string; password: string },
) => {
  if (provider === "email" && emailValues) {
    const { email, password } = emailValues;
    const result = await authClient.signIn.email({
      email: email,
      password: password,
      callbackURL: "/dashboard",
    });
    if (result.error) {
      throw new Error(result.error.message || "Sign in failed");
    }
  } else {
    await authClient.signIn.social({
      provider: provider,
      callbackURL: "/dashboard",
    });
  }
};

export const signOut = async () => {
  await authClient.signOut();
  window.location.reload();
};

export const resendVerificationEmail = async (email: string) => {
  const response = await fetch("/api/resend-verification-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, callbackURL: "/dashboard" }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    const message = body?.error || body?.message || response.statusText;
    throw new Error(message);
  }
};

export const AuthContext = createContext<{
  data: UserData;
  isPending: boolean;
  error: unknown;
  refetch: () => void | Promise<void>;
  current_site: Currentsite;
  setCurrentSite: (site: Currentsite) => void;
  demoModeEnabled: boolean;
}>(null as unknown as {
  data: UserData;
  isPending: boolean;
  error: unknown;
  refetch: () => void | Promise<void>;
  current_site: Currentsite;
  setCurrentSite: (site: Currentsite) => void;
  demoModeEnabled: boolean;
});

export type Currentsite = { name: string, id: number, tag_id: string } | null

type AuthProviderProps = {
  children: React.ReactNode;
  initialSession?: AuthUserSession | null;
  demoModeEnabled?: boolean;
};

function useCurrentSiteState(data: AuthUserSession | null) {
  const [current_site, setCurrentSite] = useState<Currentsite>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current || current_site) return;
    if (!data?.userSites?.length) return;

    let defaultSite = data.userSites[0];

    const storedSiteId = getLastSiteFromStorage();
    if (storedSiteId) {
      const storedSite = data.userSites.find((site) => site.site_id === storedSiteId);
      if (storedSite) {
        defaultSite = storedSite;
      }
    } else if (data.last_site_id) {
      const lastSite = data.userSites.find((site) => site.site_id === data.last_site_id);
      if (lastSite) {
        defaultSite = lastSite;
      }
    }

    if (!defaultSite) return;

    hasInitialized.current = true;
    setCurrentSite({
      name: defaultSite.name!,
      id: defaultSite.site_id,
      tag_id: defaultSite.tag_id,
    });
  }, [current_site, data]);

  return { current_site, setCurrentSite };
}

function DemoModeAuthProvider({ children, initialSession }: { children: React.ReactNode; initialSession: AuthUserSession | null }) {
  const data = initialSession;
  const { current_site, setCurrentSite } = useCurrentSiteState(data);

  return (
    <AuthContext.Provider
      value={{
        data,
        isPending: false,
        error: null,
        refetch: () => undefined,
        current_site,
        setCurrentSite,
        demoModeEnabled: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function LiveAuthProvider({ children }: { children: React.ReactNode }) {
  const sessionState = authClient.useSession();
  const data = sessionState.data as AuthUserSession | null;
  const { isPending, error, refetch } = sessionState;
  const refetchFreshSession = async () => {
    const sessionAtom = authClient.$store.atoms.session;
    const current = sessionAtom.get();
    sessionAtom.set({
      ...current,
      isPending: current.data === null,
      isRefetching: true,
      error: null,
      refetch: current.refetch,
    });

    const response = await authClient.$fetch("/get-session", {
      method: "GET",
      query: { disableCookieCache: true },
    });

    if (response.error) {
      sessionAtom.set({
        data: null,
        error: response.error,
        isPending: false,
        isRefetching: false,
        refetch: current.refetch,
      });
      return;
    }

    sessionAtom.set({
      data: response.data ?? null,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: current.refetch,
    });
  };
  const { current_site, setCurrentSite } = useCurrentSiteState(data);

  return (
    <AuthContext.Provider
      value={{
        data,
        isPending,
        error,
        refetch: refetchFreshSession,
        current_site,
        setCurrentSite,
        demoModeEnabled: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children, initialSession = null, demoModeEnabled = false }: AuthProviderProps) {
  if (demoModeEnabled) {
    return <DemoModeAuthProvider initialSession={initialSession}>{children}</DemoModeAuthProvider>;
  }

  return <LiveAuthProvider>{children}</LiveAuthProvider>;
}
