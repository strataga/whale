"use client";

import * as React from "react";
import { BetterConvexProvider } from "@/lib/convex/provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <BetterConvexProvider>{children}</BetterConvexProvider>;
}
