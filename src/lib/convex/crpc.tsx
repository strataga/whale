"use client";

import { api } from "@convex/_generated/api";
import { meta } from "@convex/_generated/meta";
import { createCRPCContext } from "better-convex/react";

const ctx = createCRPCContext<any>({
  api,
  meta,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});

export const CRPCProvider = ctx.CRPCProvider;
export const useCRPC = ctx.useCRPC as unknown as () => any;
export const useCRPCClient = ctx.useCRPCClient as unknown as () => any;
