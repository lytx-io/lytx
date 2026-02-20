"use client";
import { useMemo, useState } from "react";
import { resendVerificationEmail, signIn } from "@/app/providers/AuthProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";

type AuthProviders = {
  google: boolean;
  github: boolean;
};

type LoginProps = {
  authProviders?: AuthProviders;
  emailPasswordEnabled?: boolean;
  allowSignupLink?: boolean;
};

type AuthUiStatus =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | { type: "verify_email"; message: string };

function normalizeAuthErrorMessage(error: unknown) {
  let message = "Sign in failed";

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    const maybeError = (error as { error?: unknown }).error;
    if (typeof maybeMessage === "string") message = maybeMessage;
    else if (typeof maybeError === "string") message = maybeError;
  }

  // Map technical error messages to user-friendly ones
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("user not found") || lowerMessage.includes("no user found")) {
    return "No account found with this email address.";
  }
  if (lowerMessage.includes("invalid password") || lowerMessage.includes("incorrect password")) {
    return "Incorrect password. Please try again.";
  }
  if (lowerMessage.includes("invalid credentials")) {
    return "Invalid email or password.";
  }

  return message;
}

function isEmailVerificationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("verify") ||
    normalized.includes("verification") ||
    normalized.includes("email verification") ||
    normalized.includes("unverified")
  );
}

export function Login({
  authProviders = { google: true, github: true },
  emailPasswordEnabled = true,
  allowSignupLink = true,
}: LoginProps) {
  const [status, setStatus] = useState<AuthUiStatus>({ type: "idle" });
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<"google" | "github" | null>(null);

  const canResend = useMemo(() => Boolean(email.trim()) && !isResending, [email, isResending]);
  const resendLabel = isResending ? "Sending..." : "Resend verification email";

  const handleResend = async () => {
    if (!email.trim()) return;

    setIsResending(true);
    setStatus({ type: "idle" });

    try {
      await resendVerificationEmail(email);
      setStatus({ type: "success", message: "Verification email sent. Please check your inbox." });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to resend verification email";
      setStatus({ type: "error", message: errorMessage });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <ThemeProvider>
    <div className="flex flex-col justify-center items-center min-h-screen py-12 font-sans bg-slate-50 text-slate-900 dark:bg-black dark:text-slate-100">
      <div className="flex flex-col min-h-[200px] w-full justify-center items-center">
        <a
          href="/"
          className="flex items-center gap-2 h-auto font-montserrat font-bold text-2xl tracking-tight"
        >
          <img src="/logo.png" alt="Lytx logo" className="h-7 w-7" />
          <span>Lytx</span>
        </a>
        <div className="h-auto my-4">Sign in to your account</div>

        {(authProviders.google || authProviders.github) ? (
          <div className="flex flex-col gap-3 mb-6 px-4 w-full max-w-[300px]">
            {authProviders.google ? (
              <button
                onClick={async () => {
                  setPendingProvider("google");
                  try {
                    await signIn("google");
                  } catch {
                    setPendingProvider(null);
                  }
                }}
                disabled={pendingProvider !== null}
                type="button"
                className={`flex cursor-pointer items-center justify-center gap-3 w-full py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 ${pendingProvider === "google" ? "opacity-70" : pendingProvider === "github" ? "opacity-50 pointer-events-none" : ""}`}
              >
            {pendingProvider === "google" ? (
              <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
                {pendingProvider === "google" ? "Connecting..." : "Continue with Google"}
              </button>
            ) : null}

            {authProviders.github ? (
              <button
            onClick={async () => {
              setPendingProvider("github");
              try {
                await signIn("github");
              } catch {
                setPendingProvider(null);
              }
            }}
            disabled={pendingProvider !== null}
            type="button"
            className={`flex cursor-pointer items-center justify-center gap-3 w-full py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 ${pendingProvider === "github" ? "opacity-70" : pendingProvider === "google" ? "opacity-50 pointer-events-none" : ""}`}
          >
            {pendingProvider === "github" ? (
              <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            )}
            {pendingProvider === "github" ? "Connecting..." : "Continue with GitHub"}
              </button>
            ) : null}

            {emailPasswordEnabled ? (
              <div className="flex items-center my-4">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
                <div className="px-4 text-slate-500 dark:text-slate-400 text-sm">or</div>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
              </div>
            ) : null}
          </div>
        ) : null}

        {status.type !== "idle" ? (
          <div className="px-4 w-full max-w-[300px] text-sm">
            <div
              className={
                status.type === "success"
                  ? "text-green-600"
                  : status.type === "verify_email"
                    ? "text-amber-600"
                    : "text-red-600"
              }
            >
              {status.message}
            </div>
            {status.type === "verify_email" ? (
              <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                <div>Didn’t get the email? Check spam, then resend.</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {status.type === "verify_email" && (
          <div className="px-4 w-full max-w-[300px] text-sm">
            <button
              type="button"
              disabled={!canResend}
              className="underline disabled:opacity-60"
              onClick={handleResend}
            >
              {resendLabel}
            </button>
          </div>
        )}

        {emailPasswordEnabled ? (
          <form
          onSubmit={async (e) => {
            e.preventDefault();
            setStatus({ type: "idle" });

            const formData = new FormData(e.currentTarget);
            const emailValue = String(formData.get("email") || "");
            const password = String(formData.get("password") || "");
            setEmail(emailValue);

            try {
              await signIn("email", { email: emailValue, password });
            } catch (error) {
              const errorMessage = normalizeAuthErrorMessage(error);
              if (isEmailVerificationError(errorMessage)) {
                setStatus({
                  type: "verify_email",
                  message: "Email verification required. Please verify your email to sign in.",
                });
              } else {
                setStatus({ type: "error", message: errorMessage });
              }
              // Keep the entered email available for resending.
            }
          }}
          method="post" className="flex flex-col mt-2 px-4 gap-4" action="/auth/login">
          <div className="text-left">
            <label htmlFor="login-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="joe@cooldata.com"
              required
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border-b border-slate-200 dark:border-slate-700 bg-transparent mt-2 pr-4 py-2 text-base"
            />
          </div>
          <div className="text-left">
            <label htmlFor="login-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="**********"
              required
              name="password"
              className="w-full mt-2 border-b border-slate-200 dark:border-slate-700 bg-transparent pr-4 py-2 text-base"
            />
            <input
              type="hidden"
              name="path"
              defaultValue="/login"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full mt-2 bg-slate-900 text-white dark:bg-white dark:text-black py-2 border-none rounded-lg text-base cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              Sign In
            </button>
          </div>
          </form>
        ) : (
          <div className="text-sm text-slate-600 dark:text-slate-400 px-4 w-full max-w-[300px]">
            Email/password sign-in is disabled for this deployment.
          </div>
        )}
        <div className="h-5 my-4">
          {allowSignupLink ? (
            <a href="/signup" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">Create an account</a>
          ) : null}
        </div>
      </div>
    </div>
    </ThemeProvider>
  )
}
