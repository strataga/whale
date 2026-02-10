"use client";

import * as React from "react";
import { Send } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { useCRPC } from "@/lib/convex/crpc";

type Comment = {
  _id: string;
  body: string;
  authorType: string;
  authorName?: string | null;
  authorEmail?: string | null;
  _creationTime: number;
};

function formatTimeAgo(ts: number) {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommentThread({
  projectId,
  taskId,
  comments,
}: {
  projectId: string;
  taskId: string;
  comments: Comment[];
}) {
  const { toast } = useToast();
  const crpc = useCRPC();
  const [body, setBody] = React.useState("");

  const mutation = crpc.comments.create.useMutation();
  const pending = mutation.isPending;

  async function submit() {
    if (!body.trim()) return;
    try {
      await mutation.mutateAsync({ projectId, taskId, body: body.trim() });
      setBody("");
      toast("Comment added", "success");
    } catch (err: any) {
      toast(err?.message ?? "Failed to add comment", "error");
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground">
        Comments ({comments.length})
      </h4>

      {comments.length > 0 ? (
        <div className="space-y-2">
          {comments.map((c) => {
            const author = c.authorName?.trim() || c.authorEmail?.trim() || (c.authorType === "bot" ? "Bot" : "Unknown");
            return (
              <div key={c._id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{author}</span>
                  <span className="text-muted-foreground">{formatTimeAgo(c._creationTime)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a comment..."
          className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
