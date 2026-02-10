"use client";

import { ExternalLink } from "lucide-react";

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function labelFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;

    // GitHub PR detection
    if (u.hostname === "github.com" && path.includes("/pull/")) {
      const parts = path.split("/");
      const prIdx = parts.indexOf("pull");
      if (prIdx > 0) {
        const repo = parts.slice(1, prIdx).join("/");
        const prNum = parts[prIdx + 1];
        return `${repo}#${prNum}`;
      }
    }

    // GitHub commit
    if (u.hostname === "github.com" && path.includes("/commit/")) {
      const parts = path.split("/");
      const commitIdx = parts.indexOf("commit");
      if (commitIdx > 0) {
        const repo = parts.slice(1, commitIdx).join("/");
        const sha = parts[commitIdx + 1]?.slice(0, 7) ?? "";
        return `${repo}@${sha}`;
      }
    }

    // Fallback: hostname + truncated path
    const truncPath = path.length > 40 ? path.slice(0, 37) + "..." : path;
    return `${u.hostname}${truncPath}`;
  } catch {
    return url.length > 60 ? url.slice(0, 57) + "..." : url;
  }
}

export function ArtifactLinks({ links }: { links: string[] }) {
  if (links.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground">
        Artifacts ({links.length})
      </h4>
      <ul className="space-y-1.5">
        {links.map((url, i) => (
          <li key={i}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border bg-background p-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate font-medium">{labelFromUrl(url)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {domainFromUrl(url)}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
