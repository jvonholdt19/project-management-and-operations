"use server";

import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/data";
import { revalidatePath } from "next/cache";

async function nextPosition(
  table: "board_columns" | "tasks",
  filter: { col: string; val: string },
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select("position")
    .eq(filter.col, filter.val)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1000;
}

export async function addColumn(title: string) {
  const supabase = await createClient();
  const ws = await getWorkspaceId();
  if (!ws || !title.trim()) return;
  const position = await nextPosition("board_columns", { col: "workspace_id", val: ws });
  await supabase.from("board_columns").insert({ workspace_id: ws, title: title.trim(), position });
  revalidatePath("/board");
}

export async function addTask(columnId: string, title: string, projectId: string | null) {
  const supabase = await createClient();
  const ws = await getWorkspaceId();
  if (!ws || !title.trim()) return;
  const position = await nextPosition("tasks", { col: "column_id", val: columnId });
  await supabase.from("tasks").insert({
    workspace_id: ws,
    column_id: columnId,
    project_id: projectId,
    title: title.trim(),
    position,
  });
  revalidatePath("/board");
}

export async function addProject(name: string, color: string) {
  const supabase = await createClient();
  const ws = await getWorkspaceId();
  if (!ws || !name.trim()) return;
  await supabase.from("projects").insert({ workspace_id: ws, name: name.trim(), color });
  revalidatePath("/board");
}

// TODO(claude-code): moveTask(taskId, columnId, position), updateTask, deleteTask,
// subtask CRUD, project delete, column rename/delete — see BRIEF.md milestones 3-4.
