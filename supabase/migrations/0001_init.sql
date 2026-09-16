-- Lane: initial schema + row level security + new-user trigger
-- Apply in the Supabase SQL editor, or: supabase db push

create extension if not exists "pgcrypto";

-- ---------- Tables ----------
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text,
  name       text,
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My board',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid references workspaces on delete cascade,
  user_id      uuid references auth.users on delete cascade,
  role         text not null default 'member',   -- 'owner' | 'member'
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  email        text not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  name         text not null,
  color        text not null default 'indigo',
  created_at   timestamptz not null default now()
);

create table if not exists board_columns (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces on delete cascade not null,
  title        text not null,
  position     double precision not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists tasks (
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

create table if not exists subtasks (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid references tasks on delete cascade not null,
  title      text not null,
  done       boolean not null default false,
  start_date date,
  end_date   date,
  position   double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tasks_column_idx on tasks (column_id);
create index if not exists tasks_workspace_idx on tasks (workspace_id);
create index if not exists subtasks_task_idx on subtasks (task_id);

-- ---------- Membership helper (security definer avoids RLS recursion) ----------
create or replace function public.is_member(w uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = w and m.user_id = auth.uid()
  );
$$;

-- ---------- Enable RLS ----------
alter table profiles          enable row level security;
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table projects          enable row level security;
alter table board_columns     enable row level security;
alter table tasks             enable row level security;
alter table subtasks          enable row level security;

-- ---------- Policies ----------
-- Profiles: read your own + anyone you share a workspace with; write your own.
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (
  id = auth.uid() or exists (
    select 1 from workspace_members m1
    join workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  )
);
drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own on profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update using (id = auth.uid());

-- Workspaces + members: read if you belong.
drop policy if exists workspaces_read on workspaces;
create policy workspaces_read on workspaces for select using (is_member(id));
drop policy if exists members_read on workspace_members;
create policy members_read on workspace_members for select using (is_member(workspace_id));

-- Invites: members of the workspace can view/manage.
drop policy if exists invites_all on workspace_invites;
create policy invites_all on workspace_invites for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));

-- Board data: full access to members of the owning workspace.
drop policy if exists projects_all on projects;
create policy projects_all on projects for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));

drop policy if exists columns_all on board_columns;
create policy columns_all on board_columns for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));

drop policy if exists tasks_all on tasks;
create policy tasks_all on tasks for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));

drop policy if exists subtasks_all on subtasks;
create policy subtasks_all on subtasks for all
  using (exists (select 1 from tasks t where t.id = subtasks.task_id and is_member(t.workspace_id)))
  with check (exists (select 1 from tasks t where t.id = subtasks.task_id and is_member(t.workspace_id)));

-- ---------- New user: profile, invite resolution, starter board ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  -- Join any workspace that invited this email.
  insert into public.workspace_members (workspace_id, user_id, role)
  select i.workspace_id, new.id, 'member'
  from public.workspace_invites i
  where lower(i.email) = lower(new.email)
  on conflict do nothing;

  delete from public.workspace_invites where lower(email) = lower(new.email);

  -- No invites -> give them a starter board.
  if not exists (select 1 from public.workspace_members where user_id = new.id) then
    insert into public.workspaces (name, created_by) values ('My board', new.id)
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, new.id, 'owner');

    insert into public.board_columns (workspace_id, title, position) values
      (ws_id, 'Backlog', 1000),
      (ws_id, 'To do', 2000),
      (ws_id, 'In progress', 3000),
      (ws_id, 'Done', 4000);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
