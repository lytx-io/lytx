"use client";
import { ThemeProvider } from "@/app/ThemeProvider";
import { AuthProvider } from "@/app/AuthProvider";
import { AppQueryProvider } from "@/app/QueryProvider";

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
