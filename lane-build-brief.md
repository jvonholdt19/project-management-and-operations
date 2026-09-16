# Lane — Build Brief for Claude Code

Build a production, mobile-optimized, Trello-style task board with real email
authentication, a shared multi-user board, and a live deployment. A working
single-file React prototype already exists (`lane-task-board.jsx`) — treat it as
the **functional and visual reference**, and rebuild it properly on the stack below.

Work in the milestones listed at the end, in order. After each milestone, run the
app and confirm it works before moving on. Verify library and API specifics against
current official docs as you go — these ecosystems change.

---

## 1. Goal & scope (v1)

One shared Kanban board that holds **all projects at once**. Users sign in with
email + password, then create projects, columns, task cards, and subtasks, assign
work to teammates, put date ranges on tasks and subtasks, and filter the board.
Cards drag between columns on desktop and move by tap on mobile.

Out of scope for v1 (note as future work): file attachments, comments, activity
log, notifications, multiple boards per workspace, OAuth providers.

---

## 2. Tech stack

- **Next.js (App Router) + TypeScript** — deploy target is Vercel.
- **Tailwind CSS** for styling. Keep the prototype's look (see §7).
- **Supabase** for auth (email/password) and Postgres data, with **Row Level Security**.
  - Use **`@supabase/ssr`** for auth (the `auth-helpers` package is deprecated). Create
    a browser client and a server client, and a middleware that refreshes the session.
  - Env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
    (the anon key value works here during the transition). Keep the service-role key
    server-only, never exposed to the client.
- **@dnd-kit** for drag-and-drop (pointer sensor covers mouse + touch; add a keyboard
  sensor for accessibility). Do not use the native HTML5 drag API.
- **Supabase Realtime** (optional in v1, wire it if time allows) so board changes
  from one user appear for others without a refresh.
- Data fetching: server components for initial load; mutations via server actions or
  route handlers; optimistic client updates for drag/reorder so the board feels instant.

The user already has **Supabase and Vercel connectors** available — use them to
create the project, apply migrations, set env vars, and deploy.

---

## 3. Setup steps

1. Scaffold a Next.js App Router + TypeScript + Tailwind project.
2. Create (or connect) a Supabase project. Put URL + publishable key in `.env.local`.
3. Install `@supabase/supabase-js`, `@supabase/ssr`, `@dnd-kit/core`,
   `@dnd-kit/sortable`, `@dnd-kit/utilities`. Add icons (`lucide-react`).
4. Create the Supabase client utilities and the auth middleware.
5. Apply the migration in §5.
6. Build the app per §6–§9.
7. Deploy to Vercel with the env vars set (§10).

---

## 4. Sharing model

All members of a **workspace** share one board. Decisions for v1:

- On first sign-up, create a workspace named "My board" and add the creator as
  `owner`. Do this in a server action or a `handle_new_user` trigger.
- A user can invite a teammate **by email**. If that email already has an account,
  add them to `workspace_members`; otherwise store a pending invite keyed by email
  and resolve it on their next sign-in. Member management runs server-side (service
  role or a `security definer` RPC), never directly from the client.
- Everything on the board (projects, columns, tasks, subtasks) belongs to a
  workspace, and RLS scopes all reads/writes to workspace members.

Keep invites simple; if time is short, ship single-workspace-per-user in phase 1 and
add invites in phase 5.

---

## 5. Database schema + RLS (Supabase migration)

Apply this as a migration, then verify RLS is on for every table.

```sql
-- Extensions
create extension if not exists "pgcrypto";

-- Profiles mirror auth.users for display name + email
create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  name       text,
  created_at timestamptz not null default now()
);

create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My board',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid references workspaces on delete cascade,
  user_id      uuid references auth.users on delete cascade,
  role         text not null default 'member',   -- 'owner' | 'member'
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  email        text not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, email)
);

create table projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  name         text not null,
  color        text not null default 'indigo',   -- indigo|emerald|amber|rose|sky|violet|teal
  created_at   timestamptz not null default now()
);

create table board_columns (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  title        text not null,
  position     double precision not null default 0,
  created_at   timestamptz not null default now()
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  column_id    uuid references board_columns on delete cascade not null,
  project_id   uuid references projects on delete set null,
  title        text not null,
  description  text not null default '',
  assignee_id  uuid references auth.users on delete set null,
  start_date   date,
  end_date     date,
  position     double precision not null default 0,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now()
);

create table subtasks (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid references tasks on delete cascade not null,
  title      text not null,
  done       boolean not null default false,
  start_date date,
  end_date   date,
  position   double precision not null default 0,
  created_at timestamptz not null default now()
);

-- Membership helper (security definer avoids RLS recursion)
create or replace function public.is_member(w uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = w and m.user_id = auth.uid()
  );
$$;

-- Enable RLS
alter table profiles          enable row level security;
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table projects          enable row level security;
alter table board_columns     enable row level security;
alter table tasks             enable row level security;
alter table subtasks          enable row level security;

-- Profiles: read your own + anyone you share a workspace with; write your own
create policy profiles_read on profiles for select using (
  id = auth.uid() or exists (
    select 1 from workspace_members m1
    join workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);
create policy profiles_insert_own on profiles for insert with check (id = auth.uid());
create policy profiles_update_own on profiles for update using (id = auth.uid());

-- Workspaces + members: read if you're a member
create policy workspaces_read on workspaces for select using (is_member(id));
create policy members_read     on workspace_members for select using (is_member(workspace_id));
-- (owner/service-role handles inserts to workspaces, members, invites via server code)

-- Board data: full access to members of the owning workspace
create policy projects_all on projects for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy columns_all on board_columns for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy tasks_all on tasks for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
create policy subtasks_all on subtasks for all
  using (exists (select 1 from tasks t where t.id = subtasks.task_id and is_member(t.workspace_id)))
  with check (exists (select 1 from tasks t where t.id = subtasks.task_id and is_member(t.workspace_id)));
```

Also add a `handle_new_user` trigger on `auth.users` that inserts a `profiles` row,
and either creates a starter workspace or resolves any pending `workspace_invites`
for that email. Seed a new workspace with default columns **Backlog, To do,
In progress, Done**.

---

## 6. Features (must-haves, mapped from the original request)

- **Auth:** email + password sign-up and sign-in, sign-out, protected routes via
  middleware. Show the current user (name + avatar).
- **One board, filter by project:** all projects render on the same board; the
  project filter narrows the view rather than switching boards.
- **Columns:** create, rename, reorder, delete (deleting a column deletes its tasks;
  confirm first).
- **Task cards** show project tag + color, title, short description, a date badge,
  subtask progress (e.g. 2/5), and the assignee avatar. Clicking opens a detail view.
- **Task detail** (modal on desktop, full-screen sheet on mobile): edit title,
  description, project, assignee, start date, due date; manage subtasks; delete task.
- **Subtasks:** add, rename, check off, delete, and give each its own start/due date.
  A progress bar reflects completion.
- **Dates are ranges:** every task and subtask has start + due date.
- **Create everything:** tasks, subtasks, projects (name + color), columns, and
  invite users to the workspace.
- **Move cards:** drag between/within columns on desktop; a "Move to" menu on each
  card for touch. Persist the new column and order.

---

## 7. Design (keep the prototype's identity)

- **Base:** slate neutrals — `slate-100` app background, white cards, `slate-200`
  column backgrounds, `slate-700/900` text.
- **Accent:** `indigo-600` for primary actions and focus rings.
- **Project colors:** indigo, emerald, amber, rose, sky, violet, teal — used as a dot
  + tag on cards and a swatch when creating a project.
- Sentence case throughout, no all-caps labels. Rounded cards (`rounded-lg`/`xl`),
  soft borders, subtle shadows. One indigo brand mark ("Lane") in the header.
- **Mobile:** columns scroll horizontally with the board; the filter bar collapses
  into a toggle panel; the task detail opens as a bottom sheet. Hit targets ≥ 40px.
- Accessibility: visible keyboard focus, respect reduced motion, sufficient contrast.

---

## 8. Ordering & drag-and-drop

- Store order with a numeric `position` per column (tasks) and per board (columns).
- On drop, set the moved item's `position` to the midpoint of its neighbors; when
  gaps get too small, renumber that column's items. Update the DB after an optimistic
  local reorder.
- Use `@dnd-kit` sortable contexts: one per column for cards, one for the columns row.

---

## 9. Filters

A single filter panel, all combinable, matching the prototype:

- **Project** — all / specific project.
- **Assignee** — anyone / unassigned / specific member.
- **Date range** — From and To date inputs. A task matches when its `[start, end]`
  overlaps the selected window (a task with no date is excluded when a date filter is
  active). Treat a single-sided date as open-ended on the other side.
- **Search** — matches task title, description, and subtask titles.

Show an active-filter count and a one-tap clear. Prefer client-side filtering of the
loaded board for responsiveness.

---

## 10. Deployment

- Deploy to **Vercel**. Set `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only service-role key in
  Vercel project env vars.
- In Supabase Auth settings, add the Vercel production and preview URLs as allowed
  redirect/site URLs. Decide whether to require email confirmation (turning it off is
  fine for a quick internal launch; note the choice).
- Confirm the deployed app: sign up, create a project/column/task/subtask, assign,
  set dates, drag a card, filter, sign out and back in, and verify a second account
  sharing the workspace sees the same board.

---

## 11. Definition of done

- Two separate accounts in one workspace see and edit the same board.
- Every create/edit/delete/move persists across refresh and across devices.
- RLS verified: a user with no membership cannot read or write another workspace's
  rows (test with a second workspace).
- Works cleanly on a phone-width viewport and on desktop.
- No secrets in client code; service-role key is server-only.

---

## 12. Milestones (do in order, verify each)

1. **Scaffold + auth** — Next.js app, Supabase clients + middleware, sign-up /
   sign-in / sign-out, protected board route, `profiles` + new-user trigger.
2. **Schema + read board** — apply the migration; render columns and cards from the
   DB for the user's workspace (seeded defaults + any data).
3. **CRUD** — create/edit/delete for projects, columns, tasks, subtasks, including the
   task detail sheet and date ranges.
4. **Drag-and-drop + ordering** — @dnd-kit moves and reordering with persisted
   `position`; touch "Move to" fallback.
5. **Filters + members** — the filter panel (§9) and invite-by-email / assignee list.
6. **Polish + deploy** — mobile sheet, empty states, optimistic updates, optional
   Realtime, then deploy to Vercel and run the done checklist.

Reference the prototype `lane-task-board.jsx` for exact card layout, filter behavior,
date formatting, and the project color set.
