import Link from "next/link";

import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string>;
}

export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  function buildHref(targetPage: number): string {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  // Generate page numbers to show: always show first, last, and a window around current
  function getPageNumbers(): (number | "ellipsis")[] {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (page > 3) {
      pages.push("ellipsis");
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);

    return pages;
  }

  const pageNumbers = getPageNumbers();
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  const baseButtonClass =
    "inline-flex min-h-[36px] items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      {/* Previous */}
      {isFirst ? (
        <span
          className={cn(
            baseButtonClass,
            "cursor-not-allowed border-border bg-card text-muted-foreground opacity-50",
          )}
          aria-disabled="true"
        >
          Previous
        </span>
      ) : (
        <Link
          href={buildHref(page - 1)}
          className={cn(
            baseButtonClass,
            "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          Previous
        </Link>
      )}

      {/* Page numbers */}
      {pageNumbers.map((item, idx) => {
        if (item === "ellipsis") {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="inline-flex min-h-[36px] items-center justify-center px-2 text-sm text-muted-foreground"
            >
              ...
            </span>
          );
        }

        const isCurrent = item === page;
        return (
          <Link
            key={item}
            href={buildHref(item)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              baseButtonClass,
              isCurrent
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {item}
          </Link>
        );
      })}

      {/* Next */}
      {isLast ? (
        <span
          className={cn(
            baseButtonClass,
            "cursor-not-allowed border-border bg-card text-muted-foreground opacity-50",
          )}
          aria-disabled="true"
        >
          Next
        </span>
      ) : (
        <Link
          href={buildHref(page + 1)}
          className={cn(
            baseButtonClass,
            "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          Next
        </Link>
      )}
    </nav>
  );
}
