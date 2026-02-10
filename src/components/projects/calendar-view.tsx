"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CalendarTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: number | null;
}

interface CalendarMilestone {
  id: string;
  title: string;
  dueDate: number | null;
}

interface CalendarViewProps {
  projectId: string;
  tasks: CalendarTask[];
  milestones: CalendarMilestone[];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(ts: number, year: number, month: number, day: number) {
  const d = new Date(ts);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month &&
    d.getDate() === day
  );
}

const priorityDot: Record<string, string> = {
  urgent: "bg-rose-400",
  high: "bg-orange-400",
  medium: "bg-blue-400",
  low: "bg-zinc-500",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ projectId, tasks, milestones }: CalendarViewProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const tasksByDay = useMemo(() => {
    const map: Record<number, CalendarTask[]> = {};
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = new Date(t.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(t);
      }
    }
    return map;
  }, [tasks, year, month]);

  const milestonesByDay = useMemo(() => {
    const map: Record<number, CalendarMilestone[]> = {};
    for (const m of milestones) {
      if (!m.dueDate) continue;
      const d = new Date(m.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(m);
      }
    }
    return map;
  }, [milestones, year, month]);

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  }

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  // Build calendar grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
        >
          &larr;
        </button>
        <h3 className="text-lg font-semibold text-foreground">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
        >
          &rarr;
        </button>
      </div>

      {/* Day header */}
      <div className="grid grid-cols-7 gap-px">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-zinc-500">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-xl border border-border overflow-hidden">
        {cells.map((day, idx) => {
          const dayTasks = day ? tasksByDay[day] ?? [] : [];
          const dayMilestones = day ? milestonesByDay[day] ?? [] : [];
          const hasItems = dayTasks.length > 0 || dayMilestones.length > 0;

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[80px] bg-card p-1.5",
                day === null && "bg-zinc-900/50",
                isToday(day ?? 0) && "bg-primary/5",
              )}
            >
              {day !== null && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isToday(day)
                          ? "rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground"
                          : "text-zinc-400",
                      )}
                    >
                      {day}
                    </span>
                    {hasItems && (
                      <span className="text-[9px] text-zinc-600">
                        {dayTasks.length + dayMilestones.length}
                      </span>
                    )}
                  </div>

                  {/* Milestone flags */}
                  {dayMilestones.map((m) => (
                    <div
                      key={m.id}
                      className="mb-0.5 truncate rounded bg-amber-400/10 px-1 text-[10px] text-amber-300"
                      title={m.title}
                    >
                      {m.title}
                    </div>
                  ))}

                  {/* Task dots (max 3 shown, then +N) */}
                  {dayTasks.slice(0, 3).map((t) => (
                    <Link
                      key={t.id}
                      href={`/dashboard/projects/${projectId}/tasks/${t.id}`}
                      className="mb-0.5 flex items-center gap-1 truncate rounded px-1 text-[10px] text-zinc-300 hover:bg-zinc-700/50"
                      title={t.title}
                    >
                      <span
                        className={cn(
                          "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                          priorityDot[t.priority] ?? "bg-zinc-500",
                          t.status === "done" && "opacity-40",
                        )}
                      />
                      <span className={t.status === "done" ? "line-through opacity-50" : ""}>
                        {t.title}
                      </span>
                    </Link>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="block px-1 text-[9px] text-zinc-500">
                      +{dayTasks.length - 3} more
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
