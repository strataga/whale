"use client";

import * as React from "react";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { RuleForm } from "@/components/automation/rule-form";
import { useCRPC } from "@/lib/convex/crpc";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface Action {
  type: string;
  config: string;
}

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  conditions: Condition[];
  actions: Action[];
  active: number;
  createdAt: number;
  updatedAt: number;
}

const TRIGGER_LABELS: Record<string, string> = {
  "task.created": "Task Created",
  "task.updated": "Task Updated",
  "task.completed": "Task Completed",
  "bot.failed": "Bot Failed",
  "bot.idle": "Bot Idle",
  "bot_task.failed": "Bot Task Failed",
  "bot_task.completed": "Bot Task Completed",
};

export default function AutomationRulesPage() {
  const crpc = useCRPC();
  const [showForm, setShowForm] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<AutomationRule | undefined>();

  const rulesQuery = crpc.automationRules.list.useQuery();
  const updateMutation = crpc.automationRules.update.useMutation();
  const removeMutation = crpc.automationRules.remove.useMutation();

  const rules: AutomationRule[] = (rulesQuery.data ?? []).map((r) => ({
    id: r._id,
    name: r.name,
    trigger: r.trigger,
    conditions: typeof r.conditions === "string" ? JSON.parse(r.conditions) : (r.conditions ?? []),
    actions: typeof r.actions === "string" ? JSON.parse(r.actions) : (r.actions ?? []),
    active: r.active ? 1 : 0,
    createdAt: r._creationTime,
    updatedAt: r.updatedAt ?? r._creationTime,
  }));

  async function handleToggleActive(id: string, active: boolean) {
    await updateMutation.mutateAsync({ id, active });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this automation rule? This action cannot be undone.")) return;
    await removeMutation.mutateAsync({ id });
  }

  function handleEdit(rule: AutomationRule) {
    setEditingRule(rule);
    setShowForm(true);
  }

  function handleCreateNew() {
    setEditingRule(undefined);
    setShowForm(true);
  }

  function handleFormSave() {
    setShowForm(false);
    setEditingRule(undefined);
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditingRule(undefined);
  }

  if (rulesQuery.isPending) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">
            Automation Rules
          </h2>
        </div>

        <button
          type="button"
          onClick={handleCreateNew}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus className="h-4 w-4" />
          Create Rule
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <RuleForm
          rule={editingRule}
          onSave={handleFormSave}
          onCancel={handleFormCancel}
        />
      )}

      {/* Empty state */}
      {rules.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <Zap className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold">No automation rules</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a rule to automate actions when events occur.
          </p>
        </div>
      ) : (
        /* Table */
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-5 py-3 font-medium text-muted-foreground">
                  Trigger
                </th>
                <th className="px-5 py-3 font-medium text-muted-foreground">
                  Active
                </th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-5 py-4">
                    <div className="font-medium text-foreground">{rule.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {rule.conditions?.length ?? 0} condition
                      {(rule.conditions?.length ?? 0) !== 1 ? "s" : ""},
                      {" "}
                      {rule.actions?.length ?? 0} action
                      {(rule.actions?.length ?? 0) !== 1 ? "s" : ""}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rule.active === 1}
                        onChange={(e) =>
                          handleToggleActive(rule.id, e.target.checked)
                        }
                        className="rounded border-border"
                      />
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          rule.active === 1
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : "border-zinc-600 bg-zinc-700/50 text-zinc-400"
                        }`}
                      >
                        {rule.active === 1 ? "Active" : "Inactive"}
                      </span>
                    </label>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(rule)}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={`Edit rule ${rule.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 text-rose-400 hover:bg-rose-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={`Delete rule ${rule.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
