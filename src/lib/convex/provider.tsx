"use client";

import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConvexAuthProvider } from "better-convex/auth-client";
import {
  ConvexReactClient,
  getConvexQueryClientSingleton,
  getQueryClientSingleton,
  useAuthStore,
} from "better-convex/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { authClient } from "@/lib/convex/auth-client";
import { CRPCProvider } from "@/lib/convex/crpc";
import { createQueryClient } from "@/lib/convex/query-client";

export function BetterConvexProvider({
  children,
  token,
}: {
  children: ReactNode;
  token?: string;
}) {
  const router = useRouter();
  const convex = React.useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    // During `next build`, client modules can be evaluated without runtime env.
    // Avoid crashing the build; the app will still require this env at runtime.
    if (!url) return null;
    return new ConvexReactClient(url);
  }, []);

  // If Convex URL isn't configured (e.g., during build), render children without the provider.
  // Any pages relying on Convex data are client-driven and will hydrate correctly once env is set.
  if (!convex) return <>{children}</>;

  return (
    <ConvexAuthProvider
      authClient={authClient}
      client={convex}
      initialToken={token}
      onMutationUnauthorized={() => router.push("/login")}
      onQueryUnauthorized={() => router.push("/login")}
    >
      <QueryProvider convex={convex}>{children}</QueryProvider>
    </ConvexAuthProvider>
  );
}

function QueryProvider({ children, convex }: { children: ReactNode; convex: ConvexReactClient }) {
  const authStore = useAuthStore();

  const queryClient = getQueryClientSingleton(createQueryClient);
  const convexQueryClient = getConvexQueryClientSingleton({
    authStore,
    convex,
    queryClient,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <CRPCProvider convexClient={convex} convexQueryClient={convexQueryClient}>
        {children}
      </CRPCProvider>
    </QueryClientProvider>
  );
}
