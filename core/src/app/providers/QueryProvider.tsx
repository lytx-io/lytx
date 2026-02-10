"use client";
import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
interface AppQueryProviderProps {
  children: React.ReactNode;
}

export function AppQueryProvider({ children }: AppQueryProviderProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
