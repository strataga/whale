"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
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

interface AutomationRuleData {
  id: string;
  name: string;
  trigger: string;
  conditions: Condition[];
  actions: Action[];
  active: number;
  createdAt: number;
  updatedAt: number;
}

const TRIGGER_OPTIONS = [
  { value: "task.created", label: "Task Created" },
  { value: "task.updated", label: "Task Updated" },
  { value: "task.completed", label: "Task Completed" },
  { value: "bot.failed", label: "Bot Failed" },
  { value: "bot.idle", label: "Bot Idle" },
];

const CONDITION_FIELDS = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "assigneeId", label: "Assignee ID" },
  { value: "projectId", label: "Project ID" },
];

const CONDITION_OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "contains", label: "contains" },
  { value: "in", label: "in" },
];

const ACTION_TYPES = [
  { value: "update_status", label: "Update Status" },
  { value: "add_tag", label: "Add Tag" },
  { value: "notify", label: "Notify" },
  { value: "create_subtask", label: "Create Subtask" },
  { value: "escalate", label: "Escalate" },
];

export function RuleForm({
  rule,
  onSave,
  onCancel,
}: {
  rule?: AutomationRuleData;
  onSave: () => void;
  onCancel: () => void;
}) {
  const crpc = useCRPC();
  const createMutation = crpc.automationRules.create.useMutation();
  const updateMutation = crpc.automationRules.update.useMutation();

  const [name, setName] = React.useState(rule?.name ?? "");
  const [trigger, setTrigger] = React.useState(rule?.trigger ?? "task.created");
  const [conditions, setConditions] = React.useState<Condition[]>(
    rule?.conditions?.length ? rule.conditions : [],
  );
  const [actions, setActions] = React.useState<Action[]>(
    rule?.actions?.length
      ? rule.actions.map((a) => ({
          type: typeof a === "object" && "type" in a ? (a as Action).type : "",
          config:
            typeof a === "object" && "config" in a
              ? (a as Action).config
              : JSON.stringify(a),
        }))
      : [{ type: "update_status", config: "" }],
  );
  const [active, setActive] = React.useState(rule ? rule.active === 1 : true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function addCondition() {
    setConditions((prev) => [...prev, { field: "status", operator: "eq", value: "" }]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, patch: Partial<Condition>) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  function addAction() {
    setActions((prev) => [...prev, { type: "update_status", config: "" }]);
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAction(index: number, patch: Partial<Action>) {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (rule) {
        // Update existing rule
        await updateMutation.mutateAsync({
          id: rule.id,
          name,
          trigger,
          conditions: JSON.stringify(conditions),
          actions: JSON.stringify(actions),
          active,
        });
      } else {
        // Create new rule
        await createMutation.mutateAsync({
          name,
          trigger,
          conditions: JSON.stringify(conditions),
          actions: JSON.stringify(actions),
        });
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const selectClass =
    "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <h3 className="text-sm font-semibold">
        {rule ? "Edit Rule" : "Create Automation Rule"}
      </h3>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            className={inputClass}
            placeholder="e.g. Auto-escalate failed bot tasks"
          />
        </div>

        {/* Trigger Event */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground">
            Trigger Event
          </label>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            className={selectClass}
          >
            {TRIGGER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Conditions */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-muted-foreground">
              Conditions
            </label>
            <button
              type="button"
              onClick={addCondition}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3 w-3" />
              Add Condition
            </button>
          </div>

          {conditions.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              No conditions -- rule will trigger for all matching events.
            </p>
          )}

          <div className="mt-2 space-y-2">
            {conditions.map((cond, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-border bg-background p-3"
              >
                <select
                  value={cond.field}
                  onChange={(e) => updateCondition(idx, { field: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CONDITION_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(idx, { operator: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CONDITION_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  placeholder="Value"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />

                <button
                  type="button"
                  onClick={() => removeCondition(idx)}
                  className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 text-rose-400 hover:bg-rose-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Remove condition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-muted-foreground">
              Actions
            </label>
            <button
              type="button"
              onClick={addAction}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3 w-3" />
              Add Action
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {actions.map((action, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-border bg-background p-3"
              >
                <select
                  value={action.type}
                  onChange={(e) => updateAction(idx, { type: e.target.value })}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={action.config}
                  onChange={(e) => updateAction(idx, { config: e.target.value })}
                  placeholder="Config value or JSON"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />

                <button
                  type="button"
                  onClick={() => removeAction(idx)}
                  disabled={actions.length <= 1}
                  className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 text-rose-400 hover:bg-rose-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
                  aria-label="Remove action"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Active checkbox */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm text-foreground">Active</span>
        </label>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting || actions.length === 0}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
          >
            {submitting ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
