import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, X, Search, Calendar, Filter, MoreVertical, Trash2, Check,
  ChevronDown, LogOut, CheckSquare, Square, Layers, Pencil, Users, ArrowRight
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Storage helpers (persist across sessions; shared board + accounts) */
/* ------------------------------------------------------------------ */
const hasStore = typeof window !== "undefined" && window.storage;
const mem = {}; // fallback if storage unavailable

async function sGet(key, shared = false) {
  if (!hasStore) return mem[key] ?? null;
  try {
    const r = await window.storage.get(key, shared);
    return r ? JSON.parse(r.value) : null;
  } catch {
    return null;
  }
}
async function sSet(key, value, shared = false) {
  if (!hasStore) { mem[key] = value; return; }
  try { await window.storage.set(key, JSON.stringify(value), shared); }
  catch (e) { console.error("save failed", e); }
}

/* ------------------------------------------------------------------ */
/*  Small utilities                                                    */
/* ------------------------------------------------------------------ */
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);

function hashPw(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "h" + h.toString(16);
}

function fmtRange(a, b) {
  if (!a && !b) return null;
  const f = (d) => { const [, m, dd] = d.split("-"); return `${m}/${dd}`; };
  if (a && b) return a === b ? f(a) : `${f(a)} – ${f(b)}`;
  return f(a || b);
}

function overlaps(task, from, to) {
  if (!from && !to) return true;
  const s = task.startDate || task.endDate;
  const e = task.endDate || task.startDate;
  if (!s && !e) return false;
  const lo = from || "0000-00-00";
  const hi = to || "9999-12-31";
  return s <= hi && e >= lo;
}

const PROJECT_COLORS = [
  { name: "indigo",  dot: "bg-indigo-500",  bar: "bg-indigo-500",  chip: "bg-indigo-100 text-indigo-700",  ring: "ring-indigo-500" },
  { name: "emerald", dot: "bg-emerald-500", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-500" },
  { name: "amber",   dot: "bg-amber-500",   bar: "bg-amber-500",   chip: "bg-amber-100 text-amber-700",     ring: "ring-amber-500" },
  { name: "rose",    dot: "bg-rose-500",    bar: "bg-rose-500",    chip: "bg-rose-100 text-rose-700",       ring: "ring-rose-500" },
  { name: "sky",     dot: "bg-sky-500",     bar: "bg-sky-500",     chip: "bg-sky-100 text-sky-700",         ring: "ring-sky-500" },
  { name: "violet",  dot: "bg-violet-500",  bar: "bg-violet-500",  chip: "bg-violet-100 text-violet-700",   ring: "ring-violet-500" },
  { name: "teal",    dot: "bg-teal-500",    bar: "bg-teal-500",    chip: "bg-teal-100 text-teal-700",       ring: "ring-teal-500" },
];
const colorOf = (name) => PROJECT_COLORS.find((c) => c.name === name) || PROJECT_COLORS[0];

const AVATAR_BG = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-sky-500", "bg-violet-500", "bg-teal-500", "bg-slate-500"];
function avatarColor(id) {
  let h = 0; for (const c of id) h += c.charCodeAt(0);
  return AVATAR_BG[h % AVATAR_BG.length];
}
const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function Avatar({ user, size = "sm" }) {
  if (!user) return null;
  const s = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-xs";
  return (
    <span title={user.name}
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white ${avatarColor(user.id)} ${s}`}>
      {initials(user.name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Seed data (first run only)                                         */
/* ------------------------------------------------------------------ */
function seedBoard() {
  const p1 = uid(), p2 = uid(), p3 = uid();
  const c1 = uid(), c2 = uid(), c3 = uid(), c4 = uid();
  return {
    projects: [
      { id: p1, name: "Website redesign", color: "indigo" },
      { id: p2, name: "Mobile app", color: "emerald" },
      { id: p3, name: "Marketing", color: "amber" },
    ],
    columns: [
      { id: c1, title: "Backlog" },
      { id: c2, title: "To do" },
      { id: c3, title: "In progress" },
      { id: c4, title: "Done" },
    ],
    tasks: [
      { id: uid(), columnId: c2, projectId: p1, title: "New landing page", description: "Hero, pricing and testimonials sections.", assigneeId: null, startDate: todayISO(), endDate: null, subtasks: [
        { id: uid(), title: "Wireframe", done: true, startDate: null, endDate: null },
        { id: uid(), title: "Copywriting", done: false, startDate: null, endDate: null },
      ]},
      { id: uid(), columnId: c3, projectId: p2, title: "Push notifications", description: "Wire up FCM and opt-in flow.", assigneeId: null, startDate: todayISO(), endDate: null, subtasks: [] },
      { id: uid(), columnId: c1, projectId: p3, title: "Q3 campaign brief", description: "Draft goals, audience and channels.", assigneeId: null, startDate: null, endDate: null, subtasks: [] },
    ],
  };
}

/* ================================================================== */
/*  AUTH SCREEN                                                        */
/* ================================================================== */
function Auth({ onAuthed }) {
  const [mode, setMode] = useState("in"); // in | up
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    const e = email.trim().toLowerCase();
    if (!e || !pw) return setErr("Enter your email and password.");
    if (mode === "up" && !name.trim()) return setErr("Enter your name.");
    setBusy(true);
    const users = (await sGet("users", true)) || [];
    if (mode === "up") {
      if (users.some((u) => u.email === e)) { setBusy(false); return setErr("That email is already registered. Try signing in."); }
      const user = { id: uid(), name: name.trim(), email: e, pw: hashPw(pw) };
      const next = [...users, user];
      await sSet("users", next, true);
      await sSet("session", user.id);
      onAuthed(user, next);
    } else {
      const user = users.find((u) => u.email === e && u.pw === hashPw(pw));
      if (!user) { setBusy(false); return setErr("No account matches that email and password."); }
      await sSet("session", user.id);
      onAuthed(user, users);
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Layers className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight text-slate-900">Lane</span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-lg font-semibold text-slate-900">
            {mode === "in" ? "Sign in to your board" : "Create your account"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "in" ? "Pick up where your team left off." : "One board for every project."}
          </p>

          <div className="mt-5 space-y-3">
            {mode === "up" && (
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Alex Rivera" />
              </Field>
            )}
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="you@work.com" />
            </Field>
            <Field label="Password">
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••" />
            </Field>

            {err && <p className="text-sm text-rose-600">{err}</p>}

            <button onClick={submit} disabled={busy}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
            </button>
          </div>

          <p className="mt-4 text-center text-sm text-slate-500">
            {mode === "in" ? "New here? " : "Already have an account? "}
            <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }}
              className="font-semibold text-indigo-600 hover:underline">
              {mode === "in" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Prototype sign-in — accounts and the board are stored in this artifact and shared by everyone who opens it.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

/* ================================================================== */
/*  MAIN APP                                                           */
/* ================================================================== */
export default function App() {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);

  const [projects, setProjects] = useState([]);
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const loaded = useRef(false);

  // filters
  const [fProject, setFProject] = useState("all");
  const [fAssignee, setFAssignee] = useState("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ui state
  const [openTask, setOpenTask] = useState(null); // task id
  const [dragId, setDragId] = useState(null);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);

  /* ---- initial load ---- */
  useEffect(() => {
    (async () => {
      const sid = await sGet("session");
      const us = (await sGet("users", true)) || [];
      setUsers(us);
      if (sid) { const u = us.find((x) => x.id === sid); if (u) setMe(u); }

      let board = await sGet("board", true);
      if (!board) { board = seedBoard(); await sSet("board", board, true); }
      setProjects(board.projects || []);
      setColumns(board.columns || []);
      setTasks(board.tasks || []);
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  /* ---- persist board on change ---- */
  useEffect(() => {
    if (!loaded.current) return;
    sSet("board", { projects, columns, tasks }, true);
  }, [projects, columns, tasks]);

  function onAuthed(user, allUsers) { setMe(user); setUsers(allUsers); }
  async function signOut() { await sSet("session", null); setMe(null); }

  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const projById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  /* ---- filtering ---- */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (fProject !== "all" && t.projectId !== fProject) return false;
      if (fAssignee !== "all") {
        if (fAssignee === "none" ? t.assigneeId : t.assigneeId !== fAssignee) return false;
      }
      if ((fFrom || fTo) && !overlaps(t, fFrom, fTo)) return false;
      if (needle) {
        const hay = (t.title + " " + (t.description || "") + " " +
          t.subtasks.map((s) => s.title).join(" ")).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [tasks, fProject, fAssignee, fFrom, fTo, q]);

  const activeFilters =
    (fProject !== "all" ? 1 : 0) + (fAssignee !== "all" ? 1 : 0) +
    (fFrom || fTo ? 1 : 0) + (q.trim() ? 1 : 0);

  function clearFilters() {
    setFProject("all"); setFAssignee("all"); setFFrom(""); setFTo(""); setQ("");
  }

  /* ---- task ops ---- */
  function addTask(columnId, title) {
    const t = {
      id: uid(), columnId,
      projectId: fProject !== "all" ? fProject : (projects[0]?.id || null),
      title, description: "", assigneeId: null, startDate: null, endDate: null, subtasks: [],
    };
    setTasks((p) => [...p, t]);
  }
  function updateTask(id, patch) {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function deleteTask(id) {
    setTasks((p) => p.filter((t) => t.id !== id));
    setOpenTask(null);
  }
  function moveTask(taskId, targetColumnId, beforeTaskId = null) {
    setTasks((prev) => {
      const moving = prev.find((t) => t.id === taskId);
      if (!moving) return prev;
      const rest = prev.filter((t) => t.id !== taskId);
      const moved = { ...moving, columnId: targetColumnId };
      if (beforeTaskId) {
        const idx = rest.findIndex((t) => t.id === beforeTaskId);
        rest.splice(idx < 0 ? rest.length : idx, 0, moved);
      } else {
        let insertAt = rest.length;
        for (let i = rest.length - 1; i >= 0; i--) {
          if (rest[i].columnId === targetColumnId) { insertAt = i + 1; break; }
        }
        rest.splice(insertAt, 0, moved);
      }
      return rest;
    });
  }

  /* ---- subtask ops ---- */
  function addSubtask(taskId, title) {
    setTasks((p) => p.map((t) => t.id === taskId
      ? { ...t, subtasks: [...t.subtasks, { id: uid(), title, done: false, startDate: null, endDate: null }] }
      : t));
  }
  function updateSubtask(taskId, subId, patch) {
    setTasks((p) => p.map((t) => t.id === taskId
      ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, ...patch } : s)) }
      : t));
  }
  function deleteSubtask(taskId, subId) {
    setTasks((p) => p.map((t) => t.id === taskId
      ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t));
  }

  /* ---- project / column ops ---- */
  function addProject(name, color) {
    setProjects((p) => [...p, { id: uid(), name, color }]);
  }
  function deleteProject(id) {
    setProjects((p) => p.filter((x) => x.id !== id));
    setTasks((p) => p.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)));
    if (fProject === id) setFProject("all");
  }
  function addColumn(title) { setColumns((c) => [...c, { id: uid(), title }]); }
  function renameColumn(id, title) { setColumns((c) => c.map((x) => (x.id === id ? { ...x, title } : x))); }
  function deleteColumn(id) {
    setColumns((c) => c.filter((x) => x.id !== id));
    setTasks((p) => p.filter((t) => t.columnId !== id));
  }

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-400">Loading…</div>;
  }
  if (!me) return <Auth onAuthed={onAuthed} />;

  const current = openTask ? tasks.find((t) => t.id === openTask) : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="px-3 sm:px-5 h-14 flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shrink-0">
            <Layers className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 leading-tight truncate">Lane</h1>
            <p className="text-xs text-slate-400 leading-tight hidden sm:block">All projects, one board</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-slate-100 pl-1 pr-3 py-1">
              <Avatar user={me} />
              <span className="text-sm font-medium text-slate-700 truncate">{me.name}</span>
            </div>
            <button onClick={signOut} title="Sign out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-3 sm:px-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards…"
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button onClick={() => setShowFilters((s) => !s)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                showFilters || activeFilters ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-600"}`}>
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilters > 0 && (
                <span className="inline-flex h-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-xs font-semibold text-white">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <Select label="Project" value={fProject} onChange={setFProject}
                options={[{ v: "all", l: "All projects" }, ...projects.map((p) => ({ v: p.id, l: p.name }))]} />
              <Select label="Assignee" value={fAssignee} onChange={setFAssignee}
                options={[{ v: "all", l: "Anyone" }, { v: "none", l: "Unassigned" }, ...users.map((u) => ({ v: u.id, l: u.name }))]} />
              <div>
                <span className="block text-xs font-medium text-slate-600 mb-1">From</span>
                <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-600 mb-1">To</span>
                <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between">
                <button onClick={() => setAddProjectOpen(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline">
                  <Plus className="h-4 w-4" /> New project
                </button>
                {activeFilters > 0 && (
                  <button onClick={clearFilters} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Board */}
      <main className="flex-1 overflow-x-auto">
        <div className="flex gap-3 p-3 sm:p-5 items-start min-h-full">
          {columns.map((col) => {
            const colTasks = filtered.filter((t) => t.columnId === col.id);
            return (
              <Column
                key={col.id}
                col={col}
                tasks={colTasks}
                columns={columns}
                projById={projById}
                userById={userById}
                onOpen={setOpenTask}
                onAddTask={addTask}
                onRename={renameColumn}
                onDelete={deleteColumn}
                onMove={moveTask}
                dragId={dragId}
                setDragId={setDragId}
                totalInColumn={tasks.filter((t) => t.columnId === col.id).length}
              />
            );
          })}

          <button onClick={() => setAddColumnOpen(true)}
            className="shrink-0 w-72 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-white">
            <Plus className="inline h-4 w-4 mr-1" /> Add column
          </button>
        </div>
      </main>

      {/* Task detail */}
      {current && (
        <TaskModal
          task={current}
          projects={projects}
          users={users}
          projById={projById}
          userById={userById}
          onClose={() => setOpenTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onAddSub={addSubtask}
          onUpdateSub={updateSubtask}
          onDeleteSub={deleteSubtask}
        />
      )}

      {addProjectOpen && (
        <AddProjectModal
          projects={projects}
          onClose={() => setAddProjectOpen(false)}
          onAdd={addProject}
          onDelete={deleteProject}
        />
      )}
      {addColumnOpen && (
        <PromptModal
          title="Add column"
          placeholder="Column name"
          onClose={() => setAddColumnOpen(false)}
          onSubmit={(v) => { addColumn(v); setAddColumnOpen(false); }}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  COLUMN                                                             */
/* ================================================================== */
function Column({ col, tasks, columns, projById, userById, onOpen, onAddTask, onRename, onDelete, onMove, dragId, setDragId, totalInColumn }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function submit() {
    const v = title.trim();
    if (v) onAddTask(col.id, v);
    setTitle(""); setAdding(false);
  }

  return (
    <div
      className={`shrink-0 w-72 rounded-xl bg-slate-200/60 flex flex-col max-h-full ${dragOver ? "ring-2 ring-indigo-400" : ""}`}
      onDragOver={(e) => { if (dragId) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (dragId) { onMove(dragId, col.id); setDragId(null); } }}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        {renaming ? (
          <input autoFocus defaultValue={col.title}
            onBlur={(e) => { onRename(col.id, e.target.value.trim() || col.title); setRenaming(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        ) : (
          <h2 className="flex-1 text-sm font-semibold text-slate-700 truncate">{col.title}</h2>
        )}
        <span className="inline-flex h-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-slate-500">
          {tasks.length}
        </span>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-white">
            <MoreVertical className="h-4 w-4" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-sm">
                <button onClick={() => { setRenaming(true); setMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </button>
                <button onClick={() => { onDelete(col.id); setMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete{totalInColumn ? ` (${totalInColumn})` : ""}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-1 space-y-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} columns={columns} project={projById[t.projectId]}
            assignee={userById[t.assigneeId]} onOpen={onOpen} onMove={onMove}
            setDragId={setDragId} dragId={dragId} />
        ))}
        {tasks.length === 0 && !adding && (
          <p className="px-2 py-6 text-center text-xs text-slate-400">Drop cards here or add one below.</p>
        )}
      </div>

      <div className="p-2">
        {adding ? (
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <textarea autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={2} placeholder="Card title…"
              className="w-full resize-none text-sm focus:outline-none" />
            <div className="mt-1 flex items-center gap-2">
              <button onClick={submit} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Add card</button>
              <button onClick={() => { setAdding(false); setTitle(""); }} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 hover:bg-white hover:text-slate-700">
            <Plus className="h-4 w-4" /> Add card
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  TASK CARD                                                          */
/* ================================================================== */
function TaskCard({ task, columns, project, assignee, onOpen, onMove, setDragId, dragId }) {
  const [menu, setMenu] = useState(false);
  const range = fmtRange(task.startDate, task.endDate);
  const done = task.subtasks.filter((s) => s.done).length;
  const total = task.subtasks.length;
  const pc = project ? colorOf(project.color) : null;

  return (
    <div
      draggable
      onDragStart={(e) => { setDragId(task.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={() => setDragId(null)}
      onDragOver={(e) => { if (dragId && dragId !== task.id) { e.preventDefault(); e.stopPropagation(); } }}
      onDrop={(e) => { if (dragId && dragId !== task.id) { e.preventDefault(); e.stopPropagation(); onMove(dragId, task.columnId, task.id); setDragId(null); } }}
      onClick={() => onOpen(task.id)}
      className={`group relative cursor-pointer rounded-lg bg-white p-2.5 shadow-sm border border-slate-200 hover:border-slate-300 ${dragId === task.id ? "opacity-40" : ""}`}
    >
      {project && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${pc.dot}`} />
          <span className="text-xs font-medium text-slate-500 truncate">{project.name}</span>
        </div>
      )}
      <p className="text-sm font-medium text-slate-800 leading-snug pr-5">{task.title}</p>
      {task.description && (
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{task.description}</p>
      )}

      {(range || total > 0 || assignee) && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {range && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              <Calendar className="h-3 w-3" /> {range}
            </span>
          )}
          {total > 0 && (
            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${done === total ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              <CheckSquare className="h-3 w-3" /> {done}/{total}
            </span>
          )}
          <span className="ml-auto">{assignee && <Avatar user={assignee} />}</span>
        </div>
      )}

      {/* card menu (move — works on touch) */}
      <div className="absolute right-1 top-1">
        <button onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-60 group-hover:opacity-100 hover:bg-slate-100">
          <MoreVertical className="h-4 w-4" />
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenu(false); }} />
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-sm"
              onClick={(e) => e.stopPropagation()}>
              <p className="px-3 py-1 text-xs font-semibold text-slate-400">Move to</p>
              {columns.filter((c) => c.id !== task.columnId).map((c) => (
                <button key={c.id} onClick={() => { onMove(task.id, c.id); setMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" /> {c.title}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  TASK DETAIL MODAL                                                  */
/* ================================================================== */
function TaskModal({ task, projects, users, projById, userById, onClose, onUpdate, onDelete, onAddSub, onUpdateSub, onDeleteSub }) {
  const [subTitle, setSubTitle] = useState("");
  const [editingSub, setEditingSub] = useState(null);
  const project = projById[task.projectId];
  const done = task.subtasks.filter((s) => s.done).length;

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh" }}
        className="w-full sm:max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        {/* header */}
        <div className="sticky top-0 flex items-start gap-2 border-b border-slate-100 bg-white px-4 py-3">
          <div className="flex-1 min-w-0">
            <textarea value={task.title} onChange={(e) => onUpdate(task.id, { title: e.target.value })}
              rows={1}
              className="w-full resize-none text-base font-semibold text-slate-900 focus:outline-none" />
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-5">
          {/* meta grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Project</Label>
              <select value={task.projectId || ""} onChange={(e) => onUpdate(task.id, { projectId: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Assignee</Label>
              <select value={task.assigneeId || ""} onChange={(e) => onUpdate(task.id, { assigneeId: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Start date</Label>
              <input type="date" value={task.startDate || ""} onChange={(e) => onUpdate(task.id, { startDate: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <Label>Due date</Label>
              <input type="date" value={task.endDate || ""} onChange={(e) => onUpdate(task.id, { endDate: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* description */}
          <div>
            <Label>Description</Label>
            <textarea value={task.description} onChange={(e) => onUpdate(task.id, { description: e.target.value })}
              rows={3} placeholder="Add more detail…"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {/* subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Subtasks {task.subtasks.length > 0 && <span className="text-slate-400 font-normal">· {done}/{task.subtasks.length}</span>}</Label>
            </div>
            {task.subtasks.length > 0 && (
              <div className="mb-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${(done / task.subtasks.length) * 100}%` }} />
              </div>
            )}
            <div className="space-y-1.5">
              {task.subtasks.map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-200 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onUpdateSub(task.id, s.id, { done: !s.done })} className="shrink-0 text-slate-400 hover:text-emerald-600">
                      {s.done ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4" />}
                    </button>
                    {editingSub === s.id ? (
                      <input autoFocus defaultValue={s.title}
                        onBlur={(e) => { onUpdateSub(task.id, s.id, { title: e.target.value.trim() || s.title }); setEditingSub(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        className="flex-1 rounded border border-slate-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <span onClick={() => setEditingSub(s.id)}
                        className={`flex-1 text-sm cursor-text ${s.done ? "line-through text-slate-400" : "text-slate-700"}`}>
                        {s.title}
                      </span>
                    )}
                    <button onClick={() => onDeleteSub(task.id, s.id)} className="shrink-0 text-slate-300 hover:text-rose-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 pl-6">
                    <input type="date" value={s.startDate || ""} onChange={(e) => onUpdateSub(task.id, s.id, { startDate: e.target.value || null })}
                      className="rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <span className="text-xs text-slate-300">→</span>
                    <input type="date" value={s.endDate || ""} onChange={(e) => onUpdateSub(task.id, s.id, { endDate: e.target.value || null })}
                      className="rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input value={subTitle} onChange={(e) => setSubTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && subTitle.trim()) { onAddSub(task.id, subTitle.trim()); setSubTitle(""); } }}
                placeholder="Add a subtask…"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={() => { if (subTitle.trim()) { onAddSub(task.id, subTitle.trim()); setSubTitle(""); } }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <button onClick={() => onDelete(task.id)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700">
            <Trash2 className="h-4 w-4" /> Delete card
          </button>
          <button onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Done</button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  ADD PROJECT MODAL                                                  */
/* ================================================================== */
function AddProjectModal({ projects, onClose, onAdd, onDelete }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("indigo");

  function submit() {
    if (!name.trim()) return;
    onAdd(name.trim(), color);
    setName(""); setColor("indigo");
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="font-semibold text-slate-900">Projects</h3>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 py-4 space-y-4">
          {projects.length > 0 && (
            <div className="space-y-1.5">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5">
                  <span className={`h-3 w-3 rounded-full ${colorOf(p.color).dot}`} />
                  <span className="flex-1 text-sm text-slate-700 truncate">{p.name}</span>
                  <button onClick={() => onDelete(p.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-3 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="New project name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex items-center gap-2">
              {PROJECT_COLORS.map((c) => (
                <button key={c.name} onClick={() => setColor(c.name)}
                  className={`h-6 w-6 rounded-full ${c.dot} ${color === c.name ? "ring-2 ring-offset-2 " + c.ring : ""}`} />
              ))}
            </div>
            <button onClick={submit} className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Add project</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  GENERIC PROMPT MODAL                                               */
/* ================================================================== */
function PromptModal({ title, placeholder, onClose, onSubmit }) {
  const [v, setV] = useState("");
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 py-4">
          <input autoFocus value={v} onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) onSubmit(v.trim()); }}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={() => v.trim() && onSubmit(v.trim())}
            className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Add</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Label({ children }) {
  return <span className="block text-xs font-medium text-slate-600 mb-1">{children}</span>;
}
function Select({ label, value, onChange, options }) {
  return (
    <div>
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
