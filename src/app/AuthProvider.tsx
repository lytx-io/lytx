"use client";
import { createContext, Suspense } from "react";
import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@lib/auth";
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
  await authClient.signUp.email({
    email: email,
    password: password,
    name: name,
    // callbackURL: "/dashboard"
  });
};

export const signIn = async (
  provider: "github" | "google" | "email",
  emailValues?: { email: string; password: string },
) => {
  if (provider === "email" && emailValues) {
    const { email, password } = emailValues;
    await authClient.signIn.email({
      email: email,
      password: password,
      callbackURL: "/dashboard",
    });
    // return data;
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
export const AuthContext = createContext<{
  data: UserData;
  isPending: boolean;
  error: any;
}>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending, error } = authClient.useSession();
  return (
    <AuthContext.Provider value={{ data, isPending, error }}>
      <Suspense fallback={<></>}>{children}</Suspense>
    </AuthContext.Provider>
  );
}
