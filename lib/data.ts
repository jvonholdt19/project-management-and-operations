import { createClient } from "@/lib/supabase/server";
import type { Board, Column, Profile, Project, Task } from "@/lib/types";

export async function getWorkspaceId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.workspace_id ?? null;
}

export async function getBoard(): Promise<Board | null> {
  const supabase = await createClient();
  const ws = await getWorkspaceId();
  if (!ws) return null;

  const [projectsRes, columnsRes, tasksRes, memberRes] = await Promise.all([
    supabase.from("projects").select("*").eq("workspace_id", ws).order("name"),
    supabase.from("board_columns").select("*").eq("workspace_id", ws).order("position"),
    supabase.from("tasks").select("*, subtasks(*)").eq("workspace_id", ws).order("position"),
    supabase.from("workspace_members").select("user_id").eq("workspace_id", ws),
  ]);

  const ids = (memberRes.data ?? []).map((m) => m.user_id);
  const { data: memberProfiles } = ids.length
    ? await supabase.from("profiles").select("id, name, email").in("id", ids)
    : { data: [] as Profile[] };

  return {
    workspaceId: ws,
    projects: (projectsRes.data ?? []) as Project[],
    columns: (columnsRes.data ?? []) as Column[],
    tasks: (tasksRes.data ?? []) as Task[],
    members: (memberProfiles ?? []) as Profile[],
  };
}
