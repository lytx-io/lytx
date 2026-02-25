"use client";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { AppQueryProvider } from "@/app/providers/QueryProvider";
import type { AuthUserSession } from "@lib/auth";

interface ClientProvidersProps {
  children: React.ReactNode;
  initialSession?: AuthUserSession | null;
  demoModeEnabled?: boolean;
}

export function ClientProviders({ children, initialSession = null, demoModeEnabled = false }: ClientProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider initialSession={initialSession} demoModeEnabled={demoModeEnabled}>
        <AppQueryProvider>{children}</AppQueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
