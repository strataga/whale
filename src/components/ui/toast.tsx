"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  open: boolean;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return <CheckCircle2 className="h-5 w-5 text-emerald-300" />;
    case "error":
      return <XCircle className="h-5 w-5 text-destructive" />;
    case "info":
    default:
      return <Info className="h-5 w-5 text-primary" />;
  }
}

function ToastRow({ message, type, open }: ToastItem) {
  const role = type === "error" ? "alert" : "status";
  const live = type === "error" ? "assertive" : "polite";

  return (
    <div
      role={role}
      aria-live={live}
      aria-atomic="true"
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-lg",
        "transition-all duration-200 ease-out",
        open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <ToastIcon type={type} />
      <div className="min-w-0 flex-1 leading-6">{message}</div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);

  const mountedRef = React.useRef(true);
  const timeoutIdsRef = React.useRef<number[]>([]);
  const rafIdsRef = React.useRef<number[]>([]);

  React.useEffect(() => {
    setMounted(true);

    return () => {
      mountedRef.current = false;

      for (const id of timeoutIdsRef.current) {
        window.clearTimeout(id);
      }
      for (const id of rafIdsRef.current) {
        window.cancelAnimationFrame(id);
      }

      timeoutIdsRef.current = [];
      rafIdsRef.current = [];
    };
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissToast = React.useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, open: false } : t)),
      );

      // Wait for the exit transition before removing from the DOM.
      const removeTimeout = window.setTimeout(() => {
        if (!mountedRef.current) return;
        removeToast(id);
      }, 220);
      timeoutIdsRef.current.push(removeTimeout);
    },
    [removeToast],
  );

  const toast = React.useCallback(
    (message: string, type: ToastType = "info") => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const id = createId();

      setToasts((prev) => [
        ...prev,
        { id, message: trimmed, type, open: false },
      ]);

      // Kick in the entrance transition on the next paint.
      const rafId = window.requestAnimationFrame(() => {
        if (!mountedRef.current) return;
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, open: true } : t)),
        );
      });
      rafIdsRef.current.push(rafId);

      const dismissTimeout = window.setTimeout(() => {
        if (!mountedRef.current) return;
        dismissToast(id);
      }, 4000);
      timeoutIdsRef.current.push(dismissTimeout);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted && typeof document !== "undefined"
        ? createPortal(
            <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
              {toasts.map((t) => (
                <ToastRow key={t.id} {...t} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider />");
  }

  return ctx;
}
