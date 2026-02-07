"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, UserPlus, X } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ApiError = { error?: string };

type WorkspaceUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: number;
};

type InviteResponse = {
  userId: string;
  temporaryPassword: string;
};

function formatJoined(ts: number) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function roleLabel(role: string) {
  const trimmed = (role ?? "").trim();
  if (!trimmed) return "member";
  return trimmed;
}

export function UsersAdmin({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: WorkspaceUser[];
}) {
  const router = useRouter();
  const uid = React.useId();

  const [error, setError] = React.useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [invitePending, setInvitePending] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("member");

  const [inviteResult, setInviteResult] = React.useState<
    | (InviteResponse & {
        email: string;
        name: string;
        role: string;
      })
    | null
  >(null);

  const [copyOk, setCopyOk] = React.useState(false);

  const [updatingRoleUserId, setUpdatingRoleUserId] = React.useState<
    string | null
  >(null);
  const [removingUserId, setRemovingUserId] = React.useState<string | null>(
    null,
  );
  const [confirmRemoveUser, setConfirmRemoveUser] = React.useState<{
    id: string;
    email: string;
  } | null>(null);

  async function copyTemporaryPassword() {
    if (!inviteResult?.temporaryPassword) return;

    try {
      await navigator.clipboard.writeText(inviteResult.temporaryPassword);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1400);
    } catch {
      setCopyOk(false);
    }
  }

  async function inviteUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvitePending(true);
    setError(null);

    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        name: inviteName,
        role: inviteRole,
      }),
    });

    const data = (await res.json().catch(() => null)) as
      | (InviteResponse & ApiError)
      | null;

    if (!res.ok) {
      setError(data?.error ?? "Failed to invite user.");
      setInvitePending(false);
      return;
    }

    setInvitePending(false);
    setInviteOpen(false);
    setInviteResult({
      userId: data?.userId ?? "",
      temporaryPassword: data?.temporaryPassword ?? "",
      email: inviteEmail,
      name: inviteName,
      role: inviteRole,
    });
    setInviteEmail("");
    setInviteName("");
    setInviteRole("member");
    router.refresh();
  }

  async function updateRole(targetUserId: string, nextRole: string) {
    setUpdatingRoleUserId(targetUserId);
    setError(null);

    const res = await fetch(`/api/users/${targetUserId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });

    const data = (await res.json().catch(() => null)) as ApiError | null;

    if (!res.ok) {
      setError(data?.error ?? "Failed to update role.");
      setUpdatingRoleUserId(null);
      return;
    }

    setUpdatingRoleUserId(null);
    router.refresh();
  }

  async function removeUser(targetUserId: string) {
    setRemovingUserId(targetUserId);
    setError(null);

    const res = await fetch(`/api/users/${targetUserId}`, { method: "DELETE" });
    const data = (await res.json().catch(() => null)) as ApiError | null;

    if (!res.ok) {
      setError(data?.error ?? "Failed to remove user.");
      setRemovingUserId(null);
      return;
    }

    setRemovingUserId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div
          className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {inviteResult?.temporaryPassword ? (
        <div
          className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"
          role="status"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-emerald-100">
                User invited
              </div>
              <div className="mt-1 text-sm text-emerald-100/80">
                Temporary password for{" "}
                <span className="font-medium text-emerald-100">
                  {inviteResult.email}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInviteResult(null)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Dismiss temporary password"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={inviteResult.temporaryPassword}
              className="h-11 w-full rounded-lg border border-emerald-400/30 bg-background px-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Temporary password"
            />
            <button
              type="button"
              onClick={() => void copyTemporaryPassword()}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Copy className="h-4 w-4" />
              {copyOk ? "Copied" : "Copy"}
            </button>
          </div>

          <p className="mt-2 text-xs text-emerald-100/80">
            Ask them to change it after their first login.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {users.length} user{users.length === 1 ? "" : "s"} in this workspace
        </div>

        <button
          type="button"
          onClick={() => setInviteOpen((v) => !v)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-expanded={inviteOpen}
        >
          <UserPlus className="h-4 w-4" />
          Invite User
        </button>
      </div>

      {inviteOpen ? (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold tracking-tight">Invite a user</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Whale will generate a temporary password for them.
          </p>

          <form onSubmit={inviteUser} className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor={`${uid}-email`} className="text-sm font-medium">
                Email
              </label>
              <input
                id={`${uid}-email`}
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor={`${uid}-name`} className="text-sm font-medium">
                Name
              </label>
              <input
                id={`${uid}-name`}
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                placeholder="Ada Lovelace"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor={`${uid}-role`} className="text-sm font-medium">
                Role
              </label>
              <select
                id={`${uid}-role`}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Admins can invite/remove users and manage workspace settings.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 lg:col-span-2">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                disabled={invitePending}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={invitePending}
                aria-busy={invitePending}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                {invitePending ? "Inviting…" : "Invite"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[1fr_200px_180px_220px] gap-4 border-b border-border px-6 py-3 text-xs font-semibold text-muted-foreground">
              <div>User</div>
              <div>Role</div>
              <div>Joined</div>
              <div className="text-right">Actions</div>
            </div>

            {users.length ? (
              <div className="divide-y divide-border">
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const busy =
                    invitePending ||
                    updatingRoleUserId === user.id ||
                    removingUserId === user.id;

                  return (
                    <div
                      key={user.id}
                      className="grid min-h-[44px] grid-cols-[1fr_200px_180px_220px] items-center gap-4 px-6 py-4"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {user.name?.trim() ? user.name : "—"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </div>

                      <div>
                        {isSelf ? (
                          <div className="inline-flex h-11 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground">
                            {roleLabel(user.role)}
                            <span className="ml-2 text-xs text-muted-foreground">
                              (you)
                            </span>
                          </div>
                        ) : (
                          <select
                            value={roleLabel(user.role)}
                            disabled={busy}
                            onChange={(e) =>
                              void updateRole(user.id, e.target.value)
                            }
                            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                          >
                            <option value="admin">admin</option>
                            <option value="member">member</option>
                            <option value="viewer">viewer</option>
                          </select>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        {formatJoined(user.createdAt)}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">
                            Protected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmRemoveUser({
                                id: user.id,
                                email: user.email,
                              })
                            }
                            disabled={busy}
                            aria-busy={removingUserId === user.id}
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 text-sm font-semibold text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                            {removingUserId === user.id ? "Removing…" : "Remove"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="text-sm font-semibold">No users found</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Invite a teammate to collaborate in Whale.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={!!confirmRemoveUser}
        onCancel={() => setConfirmRemoveUser(null)}
        onConfirm={() => {
          if (confirmRemoveUser) {
            void removeUser(confirmRemoveUser.id);
          }
          setConfirmRemoveUser(null);
        }}
        title="Remove user?"
        description={
          confirmRemoveUser
            ? `${confirmRemoveUser.email} will lose access to this workspace. Their assigned tasks will be unassigned.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}

