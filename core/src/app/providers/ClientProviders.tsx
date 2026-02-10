"use client";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { AppQueryProvider } from "@/app/providers/QueryProvider";

interface ClientProvidersProps {
  children: React.ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppQueryProvider>{children}</AppQueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
