"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";

import { useCRPC } from "@/lib/convex/crpc";

type Theme = "dark" | "light" | "system";

const ICONS: Record<Theme, React.ComponentType<{ className?: string }>> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    root.classList.toggle("light", !prefersDark);
  } else {
    root.classList.toggle("dark", t === "dark");
    root.classList.toggle("light", t === "light");
  }
}

export function ThemeToggle() {
  const crpc = useCRPC();
  const meQuery = crpc.users.me.useQuery({});
  const updateMeMutation = crpc.users.updateMe.useMutation();

  const [theme, setTheme] = React.useState<Theme>("dark");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Sync theme from user preference
  React.useEffect(() => {
    if (meQuery.data?.themePreference) {
      const t = meQuery.data.themePreference as Theme;
      setTheme(t);
      applyTheme(t);
    }
  }, [meQuery.data?.themePreference]);

  async function cycleTheme() {
    const order: Theme[] = ["dark", "light", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length]!;
    setTheme(next);
    applyTheme(next);

    await updateMeMutation.mutateAsync({ themePreference: next }).catch(() => {});
  }

  if (!mounted) return null;

  const Icon = ICONS[theme];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
