import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  createdAt: text("created_at").notNull(),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("collaborator"),
    jobTitle: text("job_title"),
    avatarColor: text("avatar_color").notNull().default("#0069FE"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("users_workspace_email_unique").on(
      table.workspaceId,
      table.email,
    ),
    index("users_workspace_idx").on(table.workspaceId),
  ],
);

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    industry: text("industry"),
    color: text("color").notNull().default("#0069FE"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
    archivedAt: text("archived_at"),
    endedAt: text("ended_at"),
    archivedReason: text("archived_reason"),
  },
  (table) => [
    index("clients_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const teams = sqliteTable(
  "teams",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#0069FE"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("teams_workspace_idx").on(table.workspaceId)],
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.userId] })],
);

export const clientTeams = sqliteTable(
  "client_teams",
  {
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.clientId, table.teamId] })],
);

export const routines = sqliteTable(
  "routines",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    assignmentType: text("assignment_type").notNull().default("individual"),
    frequency: text("frequency").notNull(),
    intervalValue: integer("interval_value").notNull().default(1),
    weekdays: text("weekdays"),
    dayOfMonth: integer("day_of_month"),
    dueOffsetDays: integer("due_offset_days").notNull().default(0),
    nextRunAt: text("next_run_at").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("routines_due_idx").on(
      table.workspaceId,
      table.active,
      table.nextRunAt,
    ),
  ],
);

export const routineAssignees = sqliteTable(
  "routine_assignees",
  {
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.routineId, table.userId] })],
);

export const routineTeams = sqliteTable(
  "routine_teams",
  {
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.routineId, table.teamId] })],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    routineId: text("routine_id").references(() => routines.id),
    occurrenceKey: text("occurrence_key"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    assignmentType: text("assignment_type").notNull().default("individual"),
    status: text("status").notNull().default("pending"),
    priority: text("priority").notNull().default("normal"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    dueAt: text("due_at").notNull(),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    archivedAt: text("archived_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("tasks_active_idx").on(
      table.workspaceId,
      table.archivedAt,
      table.status,
      table.dueAt,
    ),
    index("tasks_client_idx").on(table.clientId, table.archivedAt),
    uniqueIndex("tasks_routine_occurrence_unique").on(
      table.routineId,
      table.occurrenceKey,
    ),
  ],
);

export const taskAssignees = sqliteTable(
  "task_assignees",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    responsibility: text("responsibility").notNull().default("responsible"),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index("task_assignees_user_idx").on(table.userId, table.taskId),
  ],
);

export const taskTeams = sqliteTable(
  "task_teams",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.teamId] }),
    index("task_teams_team_idx").on(table.teamId, table.taskId),
  ],
);

export const taskComments = sqliteTable(
  "task_comments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("comments_task_idx").on(table.taskId, table.createdAt)],
);

export const taskEvents = sqliteTable(
  "task_events",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id),
    eventType: text("event_type").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("events_task_idx").on(table.taskId, table.createdAt)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("attachments_task_idx").on(table.taskId, table.createdAt)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: text("task_id").references(() => tasks.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    kind: text("kind").notNull().default("info"),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("notifications_user_idx").on(
      table.userId,
      table.readAt,
      table.createdAt,
    ),
  ],
);
