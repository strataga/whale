"use client";

import * as React from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";

type Attachment = {
  id: string;
  taskId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: number;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AttachmentList({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchAttachments = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments`,
      );
      if (res.ok) {
        const data = await res.json();
        setAttachments(data.attachments);
      }
    } catch {
      // silently fail on fetch
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId]);

  React.useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  async function uploadFile(file: File) {
    setError(null);

    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10 MB)");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments`,
        { method: "POST", body: formData },
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
        return;
      }

      await fetchAttachments();

    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function deleteAttachment(attachmentId: string) {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  
      }
    } catch {
      // silently fail on delete
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so the same file can be selected again
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments ({attachments.length})
        </span>
      </div>

      {/* Drag-and-drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-4 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
        }`}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <Upload className="h-5 w-5" />
        <span className="text-xs">
          {uploading
            ? "Uploading..."
            : "Drop a file here or click to upload"}
        </span>
        <span className="text-[10px] text-muted-foreground">Max 10 MB</span>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : attachments.length > 0 ? (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {a.originalName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatFileSize(a.sizeBytes)} &middot; {formatDate(a.createdAt)}
                </p>
              </div>
              <a
                href={`/api/projects/${projectId}/tasks/${taskId}/attachments/${a.id}`}
                download={a.originalName}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Download ${a.originalName}`}
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => deleteAttachment(a.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${a.originalName}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
