export interface Project {
  id: string;
  child_key: string;
  parent_key: string | null;
  rinoa_path: string;
  display_name: string;
  belongs_to: string | null;
  brief: string | null;
  next_action: string | null;
  last_session_date: string | null;
  is_stale: boolean | null;
  status: string | null;
  build_phase: string | null;
  context_status: string | null;
  current_version: string | null;
  level: number | null;
  updated_at: string | null;
}

export interface LogEntry {
  timestamp: string;
  type: "completion" | "section_complete" | "note" | "created" | "tagged" | "updated";
  message: string;
  section?: number;
}

export interface Task {
  id: string;
  project_key: string;
  text: string;
  bucket: string;
  completed: boolean;
  sort_order: number | null;
  priority: string | null;
  parent_task_id: string | null;
  is_owner_action: boolean | null;
  task_type: string | null;
  horizon: string | null;
  task_code: string | null;
  surface: string | null;
  progress: string | null;
  next_step: string | null;
  context_pointer: string | null;
  build_phase: string | null;
  mission: string | null;
  root: string | null;
  version: string | null;
  log: LogEntry[] | null;
  created_at: string;
  updated_at: string;
}

export interface SessionLog {
  id: string;
  project_key: string | null;
  session_date: string;
  surface: string;
  title: string;
  summary: string | null;
  chain_id: string | null;
  entry_point: string | null;
  mission: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

export interface SessionEvent {
  id: string;
  session_log_id: string | null;
  task_id: string | null;
  event_type: string;
  detail: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  project_key: string;
  session_log_id: string | null;
  decision: string;
  state: string;
  superseded_by: string | null;
  created_at: string;
}

export interface Deployment {
  id: string;
  project_key: string;
  module_code: string | null;
  module_slug: string | null;
  git_repo: string | null;
  vercel_project: string | null;
  custom_domain: string | null;
  vault_path: string | null;
  html_file: string | null;
  last_deploy: string | null;
  updated_at: string;
}

export interface ProjectModule {
  id: string;
  project_key: string;
  module_type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  sort_order: number;
}

export interface SkillInventory {
  id: string;
  skill_name: string;
  vault_version: string | null;
  chat_version: string | null;
  cowork_version: string | null;
  code_version: string | null;
  skill_type: string;
  notes: string | null;
  updated_at: string;
}

export interface ProjectWithCounts extends Project {
  open_tasks: number;
  this_week_tasks: number;
  this_month_tasks: number;
  completed_tasks: number;
}
