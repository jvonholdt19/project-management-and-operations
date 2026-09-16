export type ProjectColor =
  | "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "teal";

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  color: ProjectColor;
}

export interface Column {
  id: string;
  workspace_id: string;
  title: string;
  position: number;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  start_date: string | null;
  end_date: string | null;
  position: number;
}

export interface Task {
  id: string;
  workspace_id: string;
  column_id: string;
  project_id: string | null;
  title: string;
  description: string;
  assignee_id: string | null;
  start_date: string | null;
  end_date: string | null;
  position: number;
  subtasks?: Subtask[];
}

export interface Board {
  workspaceId: string;
  projects: Project[];
  columns: Column[];
  tasks: Task[];
  members: Profile[];
}
