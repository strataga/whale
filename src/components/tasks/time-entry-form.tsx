"use client";

import * as React from "react";
import { Clock, Plus } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

type TimeEntry = {
  _id: string;
  minutes: number;
  note: string;
  userName?: string | null;
  _creationTime: number;
};

export function TimeEntryForm({
  projectId,
  taskId,
  entries,
  totalMinutes,
}: {
  projectId: string;
  taskId: string;
  entries: TimeEntry[];
  totalMinutes: number;
}) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const [open, setOpen] = React.useState(false);
  const [minutes, setMinutes] = React.useState("");
  const [note, setNote] = React.useState("");

  const mutation = crpc.timeEntries.create.useMutation();
  const pending = mutation.isPending;

  async function submit() {
    const mins = parseInt(minutes, 10);
    if (!mins || mins < 1) return;

    try {
      await mutation.mutateAsync({
        projectId,
        taskId,
        minutes: mins,
        note: note.trim() || undefined,
      });
      toast("Time logged", "success");
      setMinutes("");
      setNote("");
      setOpen(false);
    } catch (err: any) {
      toast(err?.message ?? "Failed to log time", "error");
    }
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold text-muted-foreground">
            {hours > 0 ? `${hours}h ` : ""}{mins}m logged
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Log time
        </button>
      </div>

      {open ? (
        <div className="flex gap-2">
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="Min"
            min={1}
            max={1440}
            className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending || !minutes}
            className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            Log
          </button>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <ul className="space-y-1">
          {entries.slice(0, 5).map((e) => (
            <li key={e._id} className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {e.minutes}m{e.note ? ` — ${e.note}` : ""}
              </span>
              <span>{e.userName ?? ""}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
