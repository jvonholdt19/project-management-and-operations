"use client";

import { LogOut, Plus } from "lucide-react";
import type { Board, Project, Task } from "@/lib/types";
import { addColumn, addTask } from "./actions";
import { signOut } from "../login/actions";

const DOT: Record<string, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
};

/**
 * Minimal, working board: reads real data from Supabase and can create columns
 * and cards through server actions. Intentionally bare.
 * TODO(claude-code): replace with the full board from lane-task-board.jsx —
 * @dnd-kit drag/reorder, task-detail sheet with subtasks + date ranges,
 * filters, assignees, projects UI. See BRIEF.md.
 */
export default function BoardClient({ board }: { board: Board }) {
  const { projects, columns, tasks } = board;
  const projById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const firstProject = projects[0]?.id ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">
          L
        </span>
        <h1 className="font-bold text-slate-900">Lane</h1>
        <form action={signOut} className="ml-auto">
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 overflow-x-auto">
        <div className="flex items-start gap-3 p-4">
          {columns.map((col) => (
            <div key={col.id} className="w-72 shrink-0 rounded-xl bg-slate-200/60 p-2">
              <div className="flex items-center justify-between px-1 py-1">
                <h2 className="text-sm font-semibold text-slate-700">{col.title}</h2>
                <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-500">
                  {tasks.filter((t) => t.column_id === col.id).length}
                </span>
              </div>

              <div className="space-y-2">
                {tasks
                  .filter((t) => t.column_id === col.id)
                  .map((t: Task) => {
                    const proj: Project | undefined = t.project_id
                      ? projById[t.project_id]
                      : undefined;
                    return (
                      <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                        {proj && (
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${DOT[proj.color] ?? "bg-slate-400"}`} />
                            <span className="text-xs text-slate-500">{proj.name}</span>
                          </div>
                        )}
                        <p className="text-sm font-medium text-slate-800">{t.title}</p>
                        {t.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.description}</p>
                        )}
                      </div>
                    );
                  })}
              </div>

              <form
                action={async (fd: FormData) => {
                  const v = String(fd.get("t") ?? "").trim();
                  if (v) await addTask(col.id, v, firstProject);
                }}
                className="mt-2"
              >
                <input
                  name="t"
                  placeholder="Add a card…"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </form>
            </div>
          ))}

          <form
            action={async (fd: FormData) => {
              const v = String(fd.get("c") ?? "").trim();
              if (v) await addColumn(v);
            }}
            className="w-72 shrink-0"
          >
            <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-2">
              <Plus className="h-4 w-4 text-slate-400" />
              <input
                name="c"
                placeholder="Add column"
                className="w-full bg-transparent text-sm text-slate-600 focus:outline-none"
              />
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
