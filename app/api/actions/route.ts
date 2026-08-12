import type { AppUser, Task, TaskStatus } from "../../lib/types";
import { getRequestIdentity } from "../../lib/server-auth";
import {
  WORKSPACE_ID,
  createId,
  getD1,
  localDate,
  nowIso,
} from "../../lib/server-db";
import {
  canAccessTask,
  canManage,
  ensureCurrentUser,
  UserAccessError,
} from "../../lib/server-store";

export const dynamic = "force-dynamic";

type Payload = Record<string, unknown> & { action?: string };

function text(value: unknown, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function integer(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function moneyToCents(value: unknown): number {
  if (typeof value === "number") return Math.max(0, Math.round(value * 100));
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function nameFromEmail(email: string): string {
  const localPart = email.split("@")[0] || "Colaborador";
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

async function actor(): Promise<AppUser | null> {
  const identity = await getRequestIdentity();
  if (!identity) return null;
  return ensureCurrentUser(identity);
}

async function assertActiveClient(clientId: string): Promise<void> {
  const client = await getD1()
    .prepare("SELECT status FROM clients WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(clientId, WORKSPACE_ID)
    .first<{ status: string }>();
  if (!client) throw new Error("Cliente não encontrado.");
  if (client.status !== "active") {
    throw new Error("Esse cliente está fora do escopo. Reative-o antes de criar novas demandas ou rotinas.");
  }
}

async function notifyTaskParticipants(
  taskId: string,
  title: string,
  message: string,
  actorId: string,
): Promise<void> {
  const db = getD1();
  const assignees = await db
    .prepare(
      `SELECT user_id FROM task_assignees WHERE task_id = ?
       UNION
       SELECT tm.user_id FROM task_teams tt
       JOIN team_members tm ON tm.team_id = tt.team_id
       WHERE tt.task_id = ?`,
    )
    .bind(taskId, taskId)
    .all<{ user_id: string }>();
  const recipients = (assignees.results ?? []).filter(
    (item) => item.user_id !== actorId,
  );
  if (!recipients.length) return;
  const timestamp = nowIso();
  await db.batch(
    recipients.map((recipient) =>
      db
        .prepare(
          "INSERT INTO notifications (id, user_id, task_id, title, message, kind, created_at) VALUES (?, ?, ?, ?, ?, 'task', ?)",
        )
        .bind(
          createId("notification"),
          recipient.user_id,
          taskId,
          title,
          message,
          timestamp,
        ),
    ),
  );
}

async function createTask(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem criar demandas.");
  const db = getD1();
  const title = text(payload.title, 180);
  const clientId = text(payload.clientId, 100);
  const dueAt = text(payload.dueAt, 10);
  if (!title || !clientId || !/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
    throw new Error("Preencha título, cliente e prazo.");
  }
  await assertActiveClient(clientId);
  const id = createId("task");
  const timestamp = nowIso();
  const assignmentType =
    payload.assignmentType === "collective" ? "collective" : "individual";
  const priority = ["low", "normal", "high", "urgent"].includes(
    String(payload.priority),
  )
    ? String(payload.priority)
    : "normal";
  const assigneeIds = list(payload.assigneeIds);
  const teamIds = list(payload.teamIds);
  if (!assigneeIds.length && !teamIds.length) {
    throw new Error("Selecione ao menos um responsável ou uma equipe.");
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO tasks
          (id, workspace_id, client_id, title, description, assignment_type, status,
           priority, created_by, created_at, due_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        WORKSPACE_ID,
        clientId,
        title,
        text(payload.description),
        assignmentType,
        priority,
        user.id,
        timestamp,
        dueAt,
        timestamp,
      ),
    db
      .prepare(
        "INSERT INTO task_events (id, task_id, actor_id, event_type, to_value, created_at) VALUES (?, ?, ?, 'created', 'pending', ?)",
      )
      .bind(createId("event"), id, user.id, timestamp),
  ];
  for (const userId of assigneeIds) {
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO task_assignees (task_id, user_id, responsibility) VALUES (?, ?, 'responsible')",
        )
        .bind(id, userId),
    );
  }
  for (const teamId of teamIds) {
    statements.push(
      db
        .prepare("INSERT OR IGNORE INTO task_teams (task_id, team_id) VALUES (?, ?)")
        .bind(id, teamId),
    );
  }
  await db.batch(statements);
  await notifyTaskParticipants(
    id,
    "Nova demanda atribuída",
    `${title} · prazo ${dueAt.split("-").reverse().join("/")}`,
    user.id,
  );
  return { id };
}

async function updateTask(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem editar demandas.");
  const id = text(payload.id, 100);
  const title = text(payload.title, 180);
  const dueAt = text(payload.dueAt, 10);
  if (!id || !title || !/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
    throw new Error("Dados da demanda incompletos.");
  }
  const db = getD1();
  const timestamp = nowIso();
  const assigneeIds = list(payload.assigneeIds);
  const teamIds = list(payload.teamIds);
  const priority = ["low", "normal", "high", "urgent"].includes(
    String(payload.priority),
  )
    ? String(payload.priority)
    : "normal";
  const assignmentType =
    payload.assignmentType === "collective" ? "collective" : "individual";
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "UPDATE tasks SET title = ?, description = ?, due_at = ?, priority = ?, assignment_type = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
      )
      .bind(
        title,
        text(payload.description),
        dueAt,
        priority,
        assignmentType,
        timestamp,
        id,
        WORKSPACE_ID,
      ),
    db.prepare("DELETE FROM task_assignees WHERE task_id = ?").bind(id),
    db.prepare("DELETE FROM task_teams WHERE task_id = ?").bind(id),
    db
      .prepare(
        "INSERT INTO task_events (id, task_id, actor_id, event_type, to_value, created_at) VALUES (?, ?, ?, 'details_updated', ?, ?)",
      )
      .bind(createId("event"), id, user.id, dueAt, timestamp),
  ];
  for (const userId of assigneeIds) {
    statements.push(
      db
        .prepare(
          "INSERT INTO task_assignees (task_id, user_id, responsibility) VALUES (?, ?, 'responsible')",
        )
        .bind(id, userId),
    );
  }
  for (const teamId of teamIds) {
    statements.push(
      db.prepare("INSERT INTO task_teams (task_id, team_id) VALUES (?, ?)").bind(id, teamId),
    );
  }
  await db.batch(statements);
  return { id };
}

async function updateStatus(payload: Payload, user: AppUser) {
  const id = text(payload.id, 100);
  const status = text(payload.status, 30) as TaskStatus;
  if (!id || !["pending", "in_progress", "review", "completed"].includes(status)) {
    throw new Error("Status inválido.");
  }
  if (!(await canAccessTask(user, id))) throw new Error("Acesso negado.");
  const db = getD1();
  const task = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first<Task>();
  if (!task) throw new Error("Demanda não encontrada.");

  const allowed: Record<TaskStatus, TaskStatus[]> = {
    pending: ["in_progress", "completed"],
    in_progress: ["pending", "review", "completed"],
    review: ["in_progress", "completed"],
    completed: ["in_progress"],
  };
  if (!allowed[task.status].includes(status)) {
    throw new Error("Essa mudança de status não é permitida.");
  }
  if (task.status === "completed" && !canManage(user)) {
    throw new Error("Somente gestores podem reabrir uma demanda.");
  }

  const timestamp = nowIso();
  const completed = status === "completed";
  const reopened = task.status === "completed" && status !== "completed";
  await db.batch([
    db
      .prepare(
        `UPDATE tasks SET
          status = ?,
          started_at = CASE WHEN ? = 'in_progress' AND started_at IS NULL THEN ? ELSE started_at END,
          completed_at = CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE completed_at END,
          archived_at = CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE archived_at END,
          updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        status,
        status,
        timestamp,
        completed ? 1 : 0,
        completed ? timestamp : null,
        reopened ? 1 : 0,
        completed ? 1 : 0,
        completed ? timestamp : null,
        reopened ? 1 : 0,
        timestamp,
        id,
      ),
    db
      .prepare(
        "INSERT INTO task_events (id, task_id, actor_id, event_type, from_value, to_value, created_at) VALUES (?, ?, ?, 'status_changed', ?, ?, ?)"
      )
      .bind(createId("event"), id, user.id, task.status, status, timestamp),
  ]);
  await notifyTaskParticipants(
    id,
    status === "completed" ? "Demanda concluída" : "Status atualizado",
    `${task.title} agora está como ${status}.`,
    user.id,
  );
  return { id, status };
}

async function addComment(payload: Payload, user: AppUser) {
  const taskId = text(payload.taskId, 100);
  const body = text(payload.body, 3000);
  if (!taskId || !body) throw new Error("Escreva um comentário.");
  if (!(await canAccessTask(user, taskId))) throw new Error("Acesso negado.");
  const db = getD1();
  const id = createId("comment");
  const timestamp = nowIso();
  await db.batch([
    db
      .prepare(
        "INSERT INTO task_comments (id, task_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(id, taskId, user.id, body, timestamp),
    db
      .prepare(
        "INSERT INTO task_events (id, task_id, actor_id, event_type, to_value, created_at) VALUES (?, ?, ?, 'comment_added', ?, ?)"
      )
      .bind(createId("event"), taskId, user.id, body.slice(0, 120), timestamp),
  ]);
  await notifyTaskParticipants(taskId, "Novo comentário", body.slice(0, 140), user.id);
  return { id };
}

async function createClient(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem cadastrar clientes.");
  const name = text(payload.name, 120);
  if (!name) throw new Error("Informe o nome do cliente.");
  const db = getD1();
  const id = createId("client");
  await db
    .prepare(
      `INSERT INTO clients
        (id, workspace_id, name, short_name, industry, color, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
    )
    .bind(
      id,
      WORKSPACE_ID,
      name,
      text(payload.shortName, 40) || name.split(" ")[0],
      text(payload.industry, 80) || null,
      text(payload.color, 20) || "#0069FE",
      nowIso(),
    )
    .run();
  return { id };
}

async function deactivateClient(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem retirar clientes do escopo.");
  const id = text(payload.id, 100);
  const reason = text(payload.reason, 120);
  const details = text(payload.details, 360);
  const endedAt = text(payload.endedAt, 10) || localDate();
  if (!id || !reason) throw new Error("Informe a empresa e o motivo do encerramento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endedAt)) throw new Error("Informe uma data de encerramento válida.");

  const db = getD1();
  const client = await db
    .prepare("SELECT status FROM clients WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(id, WORKSPACE_ID)
    .first<{ status: string }>();
  if (!client) throw new Error("Cliente não encontrado.");
  if (client.status !== "active") throw new Error("Esse cliente já está fora do escopo.");

  const archivedReason = details ? `${reason} — ${details}` : reason;
  await db.batch([
    db
      .prepare(
        "UPDATE clients SET status = 'inactive', archived_at = ?, ended_at = ?, archived_reason = ? WHERE id = ? AND workspace_id = ?",
      )
      .bind(nowIso(), endedAt, archivedReason, id, WORKSPACE_ID),
    db
      .prepare("UPDATE routines SET active = 0 WHERE client_id = ? AND workspace_id = ?")
      .bind(id, WORKSPACE_ID),
  ]);
  return { id, status: "inactive" };
}

async function reactivateClient(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem reativar clientes.");
  const id = text(payload.id, 100);
  if (!id) throw new Error("Cliente inválido.");
  await getD1()
    .prepare(
      "UPDATE clients SET status = 'active', archived_at = NULL, ended_at = NULL, archived_reason = NULL WHERE id = ? AND workspace_id = ?",
    )
    .bind(id, WORKSPACE_ID)
    .run();
  return { id, status: "active" };
}

async function createTeam(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem criar equipes.");
  const name = text(payload.name, 100);
  if (!name) throw new Error("Informe o nome da equipe.");
  const id = createId("team");
  const db = getD1();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "INSERT INTO teams (id, workspace_id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(
        id,
        WORKSPACE_ID,
        name,
        text(payload.description, 500),
        text(payload.color, 20) || "#0069FE",
        nowIso(),
      ),
  ];
  for (const userId of list(payload.memberIds)) {
    statements.push(
      db.prepare("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)").bind(id, userId),
    );
  }
  for (const clientId of list(payload.clientIds)) {
    statements.push(
      db.prepare("INSERT INTO client_teams (client_id, team_id) VALUES (?, ?)").bind(clientId, id),
    );
  }
  await db.batch(statements);
  return { id };
}

async function updateTeam(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem editar equipes.");
  const id = text(payload.id, 100);
  const name = text(payload.name, 100);
  if (!id || !name) throw new Error("Informe o nome da equipe.");
  const db = getD1();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "UPDATE teams SET name = ?, description = ?, color = ? WHERE id = ? AND workspace_id = ?",
      )
      .bind(
        name,
        text(payload.description, 500),
        text(payload.color, 20) || "#0069FE",
        id,
        WORKSPACE_ID,
      ),
    db.prepare("DELETE FROM team_members WHERE team_id = ?").bind(id),
    db.prepare("DELETE FROM client_teams WHERE team_id = ?").bind(id),
  ];
  for (const userId of list(payload.memberIds)) {
    statements.push(
      db.prepare("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)").bind(id, userId),
    );
  }
  for (const clientId of list(payload.clientIds)) {
    statements.push(
      db.prepare("INSERT INTO client_teams (client_id, team_id) VALUES (?, ?)").bind(clientId, id),
    );
  }
  await db.batch(statements);
  return { id };
}

async function deleteTeam(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem excluir equipes.");
  const id = text(payload.id, 100);
  if (!id) throw new Error("Equipe inválida.");

  const db = getD1();
  const team = await db
    .prepare("SELECT id FROM teams WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(id, WORKSPACE_ID)
    .first<{ id: string }>();
  if (!team) throw new Error("Equipe não encontrada.");

  await db.prepare("DELETE FROM teams WHERE id = ? AND workspace_id = ?").bind(id, WORKSPACE_ID).run();
  return { id, deleted: true };
}

async function createMember(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem cadastrar colaboradores.");
  const email = text(payload.email, 180).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um e-mail válido.");
  }
  const name = text(payload.name, 120) || nameFromEmail(email);
  const role = payload.role === "manager" ? "manager" : "collaborator";
  const db = getD1();
  const existing = await db
    .prepare("SELECT id, active FROM users WHERE workspace_id = ? AND email = ? LIMIT 1")
    .bind(WORKSPACE_ID, email)
    .first<{ id: string; active: number }>();
  if (existing?.active) throw new Error("Este e-mail já possui acesso ao sistema.");

  const id = existing?.id ?? createId("user");
  const jobTitle = text(payload.jobTitle, 100) || "Colaborador";
  const color = text(payload.color, 20) || "#0069FE";
  const statements: D1PreparedStatement[] = existing
    ? [
        db.prepare("DELETE FROM team_members WHERE user_id = ?").bind(id),
        db
          .prepare(
            "UPDATE users SET name = ?, role = ?, job_title = ?, avatar_color = ?, active = 1 WHERE id = ? AND workspace_id = ?",
          )
          .bind(name, role, jobTitle, color, id, WORKSPACE_ID),
      ]
    : [
        db
          .prepare(
            `INSERT INTO users
              (id, workspace_id, email, name, role, job_title, avatar_color, active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          )
          .bind(id, WORKSPACE_ID, email, name, role, jobTitle, color, nowIso()),
      ];
  for (const teamId of list(payload.teamIds)) {
    statements.push(
      db.prepare("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)").bind(teamId, id),
    );
  }
  await db.batch(statements);
  return { id };
}

async function deactivateMember(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem remover colaboradores.");
  const id = text(payload.id, 100);
  if (!id) throw new Error("Colaborador inválido.");
  if (id === user.id) throw new Error("Você não pode remover o próprio acesso.");

  const db = getD1();
  const target = await db
    .prepare("SELECT role, active FROM users WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(id, WORKSPACE_ID)
    .first<{ role: AppUser["role"]; active: number }>();
  if (!target || !target.active) throw new Error("Colaborador não encontrado.");
  if (target.role === "owner") throw new Error("O proprietário não pode ser removido.");
  if (user.role !== "owner" && target.role === "manager") {
    throw new Error("Somente o proprietário pode remover outro gestor.");
  }

  await db.batch([
    db
      .prepare("UPDATE users SET active = 0 WHERE id = ? AND workspace_id = ?")
      .bind(id, WORKSPACE_ID),
    db.prepare("DELETE FROM team_members WHERE user_id = ?").bind(id),
    db
      .prepare(
        `DELETE FROM task_assignees
         WHERE user_id = ? AND task_id IN (
           SELECT id FROM tasks WHERE workspace_id = ? AND archived_at IS NULL
         )`,
      )
      .bind(id, WORKSPACE_ID),
    db.prepare("DELETE FROM routine_assignees WHERE user_id = ?").bind(id),
  ]);
  return { id, active: false };
}

async function updateMemberRole(payload: Payload, user: AppUser) {
  if (user.role !== "owner") throw new Error("Somente o proprietário pode alterar perfis.");
  const id = text(payload.id, 100);
  const role = payload.role === "manager" ? "manager" : "collaborator";
  await getD1()
    .prepare("UPDATE users SET role = ? WHERE id = ? AND workspace_id = ? AND role <> 'owner'")
    .bind(role, id, WORKSPACE_ID)
    .run();
  return { id, role };
}

async function createRoutine(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem criar rotinas.");
  const title = text(payload.title, 180);
  const clientId = text(payload.clientId, 100);
  const startsAt = text(payload.startsAt, 10) || localDate();
  const nextRunAt = text(payload.nextRunAt, 10) || startsAt;
  const frequency = ["daily", "weekly", "monthly"].includes(String(payload.frequency))
    ? String(payload.frequency)
    : "weekly";
  if (!title || !clientId) throw new Error("Preencha título e cliente.");
  await assertActiveClient(clientId);
  const id = createId("routine");
  const db = getD1();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO routines
          (id, workspace_id, client_id, title, description, assignment_type, frequency,
           interval_value, weekdays, day_of_month, due_offset_days, next_run_at, starts_at,
           ends_at, active, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        id,
        WORKSPACE_ID,
        clientId,
        title,
        text(payload.description),
        payload.assignmentType === "collective" ? "collective" : "individual",
        frequency,
        Math.max(1, integer(payload.intervalValue, 1)),
        frequency === "weekly" ? list(payload.weekdays).join(",") || "1" : null,
        frequency === "monthly" ? Math.min(31, Math.max(1, integer(payload.dayOfMonth, 1))) : null,
        Math.max(0, integer(payload.dueOffsetDays, 0)),
        nextRunAt,
        startsAt,
        text(payload.endsAt, 10) || null,
        user.id,
        nowIso(),
      ),
  ];
  for (const userId of list(payload.assigneeIds)) {
    statements.push(
      db.prepare("INSERT INTO routine_assignees (routine_id, user_id) VALUES (?, ?)").bind(id, userId),
    );
  }
  for (const teamId of list(payload.teamIds)) {
    statements.push(
      db.prepare("INSERT INTO routine_teams (routine_id, team_id) VALUES (?, ?)").bind(id, teamId),
    );
  }
  await db.batch(statements);
  return { id };
}

async function toggleRoutine(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem alterar rotinas.");
  const id = text(payload.id, 100);
  const active = payload.active ? 1 : 0;
  const db = getD1();
  if (active) {
    const routine = await db
      .prepare(
        `SELECT c.status AS client_status
         FROM routines r
         JOIN clients c ON c.id = r.client_id
         WHERE r.id = ? AND r.workspace_id = ? LIMIT 1`,
      )
      .bind(id, WORKSPACE_ID)
      .first<{ client_status: string }>();
    if (!routine) throw new Error("Rotina não encontrada.");
    if (routine.client_status !== "active") {
      throw new Error("Reative o cliente antes de reativar esta rotina.");
    }
  }
  await db
    .prepare("UPDATE routines SET active = ? WHERE id = ? AND workspace_id = ?")
    .bind(active, id, WORKSPACE_ID)
    .run();
  return { id, active };
}

async function saveOpportunity(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem alterar o comercial.");
  const id = text(payload.id, 100) || createId("opportunity");
  const companyName = text(payload.companyName, 160);
  const ownerId = text(payload.ownerId, 100);
  const stage = text(payload.stage, 30);
  const validStages = ["lead", "contacted", "meeting", "proposal", "negotiation", "won", "lost"];
  if (!companyName || !ownerId || !validStages.includes(stage)) {
    throw new Error("Preencha empresa, responsável e etapa da oportunidade.");
  }
  const db = getD1();
  const timestamp = nowIso();
  const existing = await db
    .prepare("SELECT id FROM sales_opportunities WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(id, WORKSPACE_ID)
    .first<{ id: string }>();
  const values = [
    companyName,
    text(payload.contactName, 120) || null,
    text(payload.contactEmail, 180) || null,
    text(payload.contactPhone, 40) || null,
    text(payload.service, 180),
    moneyToCents(payload.estimatedValue),
    stage,
    ownerId,
    text(payload.nextActionAt, 10) || null,
    text(payload.notes),
    stage === "lost" ? text(payload.lossReason, 500) || null : null,
  ] as const;
  if (existing) {
    await db
      .prepare(
        `UPDATE sales_opportunities SET company_name = ?, contact_name = ?, contact_email = ?,
         contact_phone = ?, service = ?, estimated_value = ?, stage = ?, owner_id = ?,
         next_action_at = ?, notes = ?, loss_reason = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .bind(...values, timestamp, id, WORKSPACE_ID)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO sales_opportunities
         (id, workspace_id, company_name, contact_name, contact_email, contact_phone,
          service, estimated_value, stage, owner_id, next_action_at, notes, loss_reason,
          created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, WORKSPACE_ID, ...values, user.id, timestamp, timestamp)
      .run();
  }
  return { id };
}

async function saveMeeting(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem alterar reuniões comerciais.");
  const id = text(payload.id, 100) || createId("meeting");
  const title = text(payload.title, 180);
  const companyName = text(payload.companyName, 160);
  const startsAt = text(payload.startsAt, 30);
  const responsibleId = text(payload.responsibleId, 100);
  const status = text(payload.status, 20);
  const meetingType = text(payload.meetingType, 20);
  if (!title || !companyName || !startsAt || !responsibleId) {
    throw new Error("Preencha título, empresa, data e responsável pela reunião.");
  }
  if (!["scheduled", "completed", "canceled"].includes(status)) {
    throw new Error("Status de reunião inválido.");
  }
  const db = getD1();
  const timestamp = nowIso();
  const existing = await db
    .prepare("SELECT id FROM sales_meetings WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(id, WORKSPACE_ID)
    .first<{ id: string }>();
  const values = [
    text(payload.opportunityId, 100) || null,
    title,
    companyName,
    startsAt,
    Math.min(480, Math.max(15, integer(payload.durationMinutes, 60))),
    ["online", "presential", "phone"].includes(meetingType) ? meetingType : "online",
    text(payload.location, 500) || null,
    text(payload.participants, 1000),
    text(payload.agenda),
    text(payload.outcome),
    status,
    responsibleId,
  ] as const;
  if (existing) {
    await db
      .prepare(
        `UPDATE sales_meetings SET opportunity_id = ?, title = ?, company_name = ?, starts_at = ?,
         duration_minutes = ?, meeting_type = ?, location = ?, participants = ?, agenda = ?,
         outcome = ?, status = ?, responsible_id = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .bind(...values, timestamp, id, WORKSPACE_ID)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO sales_meetings
         (id, workspace_id, opportunity_id, title, company_name, starts_at, duration_minutes,
          meeting_type, location, participants, agenda, outcome, status, responsible_id,
          created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, WORKSPACE_ID, ...values, user.id, timestamp, timestamp)
      .run();
  }
  return { id };
}

async function saveContract(payload: Payload, user: AppUser) {
  if (!canManage(user)) throw new Error("Somente gestores podem alterar contratos.");
  const id = text(payload.id, 100) || createId("contract");
  const title = text(payload.title, 180);
  const companyName = text(payload.companyName, 160);
  const ownerId = text(payload.ownerId, 100);
  const status = text(payload.status, 20);
  const billingCycle = text(payload.billingCycle, 20);
  const validStatuses = ["draft", "sent", "signed", "active", "expiring", "ended", "canceled"];
  if (!title || !companyName || !ownerId || !validStatuses.includes(status)) {
    throw new Error("Preencha contrato, empresa, responsável e status.");
  }
  const documentUrl = text(payload.documentUrl, 1000);
  if (documentUrl && !/^https?:\/\//i.test(documentUrl)) {
    throw new Error("O link do contrato deve começar com http:// ou https://.");
  }
  const db = getD1();
  const timestamp = nowIso();
  const existing = await db
    .prepare("SELECT id FROM sales_contracts WHERE id = ? AND workspace_id = ? LIMIT 1")
    .bind(id, WORKSPACE_ID)
    .first<{ id: string }>();
  const values = [
    text(payload.opportunityId, 100) || null,
    text(payload.clientId, 100) || null,
    companyName,
    title,
    moneyToCents(payload.value),
    ["one_time", "monthly", "quarterly", "annual"].includes(billingCycle) ? billingCycle : "monthly",
    text(payload.startDate, 10) || null,
    text(payload.endDate, 10) || null,
    status,
    documentUrl || null,
    text(payload.notes),
    ownerId,
  ] as const;
  if (existing) {
    await db
      .prepare(
        `UPDATE sales_contracts SET opportunity_id = ?, client_id = ?, company_name = ?,
         title = ?, value = ?, billing_cycle = ?, start_date = ?, end_date = ?, status = ?,
         document_url = ?, notes = ?, owner_id = ?, updated_at = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .bind(...values, timestamp, id, WORKSPACE_ID)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO sales_contracts
         (id, workspace_id, opportunity_id, client_id, company_name, title, value,
          billing_cycle, start_date, end_date, status, document_url, notes, owner_id,
          created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, WORKSPACE_ID, ...values, user.id, timestamp, timestamp)
      .run();
  }
  return { id };
}

async function markNotificationsRead(user: AppUser) {
  await getD1()
    .prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL")
    .bind(nowIso(), user.id)
    .run();
  return { updated: true };
}

export async function POST(request: Request) {
  try {
    const user = await actor();
    if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
    const payload = (await request.json()) as Payload;
    let result: Record<string, unknown>;
    switch (payload.action) {
      case "create_task":
        result = await createTask(payload, user);
        break;
      case "update_task":
        result = await updateTask(payload, user);
        break;
      case "update_status":
        result = await updateStatus(payload, user);
        break;
      case "add_comment":
        result = await addComment(payload, user);
        break;
      case "create_client":
        result = await createClient(payload, user);
        break;
      case "deactivate_client":
        result = await deactivateClient(payload, user);
        break;
      case "reactivate_client":
        result = await reactivateClient(payload, user);
        break;
      case "create_team":
        result = await createTeam(payload, user);
        break;
      case "update_team":
        result = await updateTeam(payload, user);
        break;
      case "delete_team":
        result = await deleteTeam(payload, user);
        break;
      case "create_member":
        result = await createMember(payload, user);
        break;
      case "deactivate_member":
        result = await deactivateMember(payload, user);
        break;
      case "update_member_role":
        result = await updateMemberRole(payload, user);
        break;
      case "create_routine":
        result = await createRoutine(payload, user);
        break;
      case "toggle_routine":
        result = await toggleRoutine(payload, user);
        break;
      case "save_opportunity":
        result = await saveOpportunity(payload, user);
        break;
      case "save_sales_meeting":
        result = await saveMeeting(payload, user);
        break;
      case "save_contract":
        result = await saveContract(payload, user);
        break;
      case "mark_notifications_read":
        result = await markNotificationsRead(user);
        break;
      default:
        return Response.json({ error: "Ação desconhecida." }, { status: 400 });
    }
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir a ação.";
    return Response.json({ error: message }, { status: error instanceof UserAccessError ? 403 : 400 });
  }
}
