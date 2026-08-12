export type Role = "owner" | "manager" | "collaborator";
export type TaskStatus = "pending" | "in_progress" | "review" | "completed";
export type Priority = "low" | "normal" | "high" | "urgent";
export type OpportunityStage = "lead" | "contacted" | "meeting" | "proposal" | "negotiation" | "won" | "lost";
export type MeetingStatus = "scheduled" | "completed" | "canceled";
export type ContractStatus = "draft" | "sent" | "signed" | "active" | "expiring" | "ended" | "canceled";

export type AppUser = {
  id: string;
  workspace_id: string;
  email: string;
  name: string;
  role: Role;
  job_title: string | null;
  avatar_color: string;
  active: number;
  created_at: string;
};

export type Client = {
  id: string;
  workspace_id: string;
  name: string;
  short_name: string;
  industry: string | null;
  color: string;
  status: string;
  created_at: string;
  archived_at: string | null;
  ended_at: string | null;
  archived_reason: string | null;
};

export type Team = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};

export type SalesOpportunity = {
  id: string;
  workspace_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  service: string;
  estimated_value: number;
  stage: OpportunityStage;
  owner_id: string;
  next_action_at: string | null;
  notes: string;
  loss_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type SalesMeeting = {
  id: string;
  workspace_id: string;
  opportunity_id: string | null;
  title: string;
  company_name: string;
  starts_at: string;
  duration_minutes: number;
  meeting_type: "online" | "presential" | "phone";
  location: string | null;
  participants: string;
  agenda: string;
  outcome: string;
  status: MeetingStatus;
  responsible_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type SalesContract = {
  id: string;
  workspace_id: string;
  opportunity_id: string | null;
  client_id: string | null;
  company_name: string;
  title: string;
  value: number;
  billing_cycle: "one_time" | "monthly" | "quarterly" | "annual";
  start_date: string | null;
  end_date: string | null;
  status: ContractStatus;
  document_url: string | null;
  notes: string;
  owner_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  workspace_id: string;
  client_id: string;
  routine_id: string | null;
  occurrence_key: string | null;
  title: string;
  description: string;
  assignment_type: "individual" | "collective";
  status: TaskStatus;
  priority: Priority;
  created_by: string;
  created_at: string;
  due_at: string;
  started_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  updated_at: string;
};

export type Routine = {
  id: string;
  workspace_id: string;
  client_id: string;
  title: string;
  description: string;
  assignment_type: "individual" | "collective";
  frequency: "daily" | "weekly" | "monthly";
  interval_value: number;
  weekdays: string | null;
  day_of_month: number | null;
  due_offset_days: number;
  next_run_at: string;
  starts_at: string;
  ends_at: string | null;
  active: number;
  created_by: string;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type TaskEvent = {
  id: string;
  task_id: string;
  actor_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
};

export type Attachment = {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  content_type: string;
  size: number;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  task_id: string | null;
  title: string;
  message: string;
  kind: string;
  read_at: string | null;
  created_at: string;
};

export type Pair = { left_id: string; right_id: string };

export type AppData = {
  currentUser: AppUser;
  clients: Client[];
  users: AppUser[];
  teams: Team[];
  tasks: Task[];
  routines: Routine[];
  salesOpportunities: SalesOpportunity[];
  salesMeetings: SalesMeeting[];
  salesContracts: SalesContract[];
  teamMembers: Pair[];
  clientTeams: Pair[];
  taskAssignees: Pair[];
  taskTeams: Pair[];
  routineAssignees: Pair[];
  routineTeams: Pair[];
  comments: TaskComment[];
  events: TaskEvent[];
  attachments: Attachment[];
  notifications: Notification[];
};
