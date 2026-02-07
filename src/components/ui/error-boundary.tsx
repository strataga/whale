"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  className?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, info);
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            "mx-auto w-full max-w-3xl px-4 py-10 sm:px-6",
            this.props.className,
          )}
        >
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl border border-border bg-background">
                <TriangleAlert className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Something went wrong
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Try again to reload this section. If it keeps happening,
                  refresh the page.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={this.reset}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

