"use client";
import { createContext, useEffect, useRef, useState } from "react";
import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@lib/auth";
import { getLastSiteFromStorage } from "@/app/components/SiteSelector";
export const authClient = createAuthClient({
  plugins: [customSessionClient<typeof auth>()],
});
// type Provider = Params<ReturnType<typeof authClient.signIn.social>>["provider"]
type UserData = ReturnType<typeof authClient.useSession>["data"];
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
  error: any;
  refetch: () => void | Promise<void>;
  current_site: Currentsite;
  setCurrentSite: (site: Currentsite) => void;
}>(null as any);

export type Currentsite = { name: string, id: number, tag_id: string } | null

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending, error, refetch } = authClient.useSession();
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
  //Current Site ID
  const [current_site, setCurrentSite] = useState<Currentsite>(null);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current || current_site) return;
    if (!data?.userSites?.length) return;

    // Priority: localStorage > session.last_site_id > first site
    let defaultSite = data.userSites[0];
    
    // Check localStorage first (most recent selection)
    const storedSiteId = getLastSiteFromStorage();
    if (storedSiteId) {
      const storedSite = data.userSites.find(site => site.site_id === storedSiteId);
      if (storedSite) {
        defaultSite = storedSite;
      }
    } else if (data.last_site_id) {
      // Fall back to session data (from database)
      const lastSite = data.userSites.find(site => site.site_id === data.last_site_id);
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

  //WARNING: Only using for dev
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("🔥🔥🔥 Effect for current_site has been triggered")
      if (current_site) console.dir(current_site);
    }
    //Fetch to update session in better-auth
  }, [current_site]);

  return (
    <AuthContext.Provider
      value={{
        data,
        isPending,
        error,
        refetch: refetchFreshSession,
        current_site,
        setCurrentSite,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
