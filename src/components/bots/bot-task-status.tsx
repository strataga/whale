import { cn } from "@/lib/utils";

function statusStyles(status?: string | null) {
  switch (status) {
    case "pending":
      return "border-border bg-muted text-muted-foreground";
    case "running":
      return "border-yellow-400/30 bg-yellow-400/10 text-yellow-200";
    case "completed":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "failed":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function BotTaskStatus({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const label = (status ?? "pending").replaceAll("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        statusStyles(status),
        className,
      )}
      title={label}
    >
      {label}
    </span>
  );
}

