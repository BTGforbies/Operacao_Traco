import type {
  AppData,
  AppUser,
  Attachment,
  Client,
  Notification,
  Pair,
  Routine,
  SalesContract,
  SalesMeeting,
  SalesOpportunity,
  Task,
  TaskComment,
  TaskEvent,
  Team,
} from "./types";
import type { RequestIdentity } from "./server-auth";
import {
  WORKSPACE_ID,
  addDays,
  createId,
  getD1,
  localDate,
  nowIso,
} from "./server-db";

type CountRow = { count: number };

export class UserAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserAccessError";
  }
}

async function rows<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}

export async function ensureCurrentUser(
  identity: RequestIdentity,
): Promise<AppUser> {
  const db = getD1();
  const timestamp = nowIso();

  await db
    .prepare(
      "INSERT OR IGNORE INTO workspaces (id, name, timezone, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(WORKSPACE_ID, "Traço 61", "America/Sao_Paulo", timestamp)
    .run();

  let user = await db
    .prepare("SELECT * FROM users WHERE workspace_id = ? AND email = ? LIMIT 1")
    .bind(WORKSPACE_ID, identity.email)
    .first<AppUser>();

  if (!user) {
    const count = await db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE workspace_id = ?")
      .bind(WORKSPACE_ID)
      .first<CountRow>();
    if ((count?.count ?? 0) > 0) {
      throw new UserAccessError(
        "Este e-mail ainda não foi cadastrado pela gestão da agência.",
      );
    }
    const id = createId("user");
    const role = "owner";
    await db
      .prepare(
        `INSERT INTO users
          (id, workspace_id, email, name, role, job_title, avatar_color, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .bind(
        id,
        WORKSPACE_ID,
        identity.email,
        identity.name,
        role,
        role === "owner" ? "Gestor da agência" : "Colaborador",
        "#0069FE",
        timestamp,
      )
      .run();
    user = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first<AppUser>();
  }

  if (!user) throw new Error("Não foi possível preparar o usuário atual.");
  if (!user.active) {
    throw new UserAccessError(
      "O acesso deste e-mail foi removido pela gestão da agência.",
    );
  }
  await seedWorkspace(user);
  return user;
}

async function seedWorkspace(owner: AppUser): Promise<void> {
  const db = getD1();
  const existing = await db
    .prepare("SELECT COUNT(*) AS count FROM clients WHERE workspace_id = ?")
    .bind(WORKSPACE_ID)
    .first<CountRow>();
  if ((existing?.count ?? 0) > 0) return;

  const createdAt = nowIso();
  const today = localDate();
  const sampleUsers = [
    ["user-ana", "ana@agencia.local", "Ana Martins", "manager", "Social Media", "#7C3AED"],
    ["user-lucas", "lucas@agencia.local", "Lucas Rocha", "collaborator", "Designer", "#F97316"],
    ["user-marina", "marina@agencia.local", "Marina Alves", "collaborator", "Tráfego pago", "#10B981"],
    ["user-rafael", "rafael@agencia.local", "Rafael Souza", "collaborator", "Dados e BI", "#E11D48"],
  ] as const;

  const clients = [
    ["client-rostbif", "Rostbif", "Rostbif", "Gastronomia", "#F97316"],
    ["client-madruga", "Madruga Tech", "Madruga", "Tecnologia", "#2563EB"],
    ["client-braz", "Braz Cosmética", "Braz", "Beleza", "#D946EF"],
    ["client-moara", "Moara Beach", "Moara", "Turismo", "#06B6D4"],
    ["client-copa", "Copa Estofados", "Copa", "Serviços", "#65A30D"],
  ] as const;

  const statements: D1PreparedStatement[] = [];

  for (const user of sampleUsers) {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO users
            (id, workspace_id, email, name, role, job_title, avatar_color, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        )
        .bind(user[0], WORKSPACE_ID, ...user.slice(1), createdAt),
    );
  }

  for (const client of clients) {
    statements.push(
      db
        .prepare(
          `INSERT INTO clients
            (id, workspace_id, name, short_name, industry, color, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
        )
        .bind(client[0], WORKSPACE_ID, ...client.slice(1), createdAt),
    );
  }

  const teams = [
    ["team-content", "Conteúdo & Criação", "Social, design e produção criativa", "#7C3AED"],
    ["team-performance", "Performance", "Tráfego pago, métricas e otimização", "#0069FE"],
    ["team-strategy", "Estratégia", "Planejamento, atendimento e aprovação", "#0F766E"],
  ] as const;
  for (const team of teams) {
    statements.push(
      db
        .prepare(
          "INSERT INTO teams (id, workspace_id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(team[0], WORKSPACE_ID, ...team.slice(1), createdAt),
    );
  }

  const teamMembers = [
    ["team-content", owner.id],
    ["team-content", "user-ana"],
    ["team-content", "user-lucas"],
    ["team-performance", owner.id],
    ["team-performance", "user-marina"],
    ["team-performance", "user-rafael"],
    ["team-strategy", owner.id],
    ["team-strategy", "user-ana"],
  ];
  for (const relation of teamMembers) {
    statements.push(
      db
        .prepare("INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)")
        .bind(...relation),
    );
  }

  const clientTeams = [
    ["client-rostbif", "team-content"],
    ["client-rostbif", "team-performance"],
    ["client-madruga", "team-content"],
    ["client-madruga", "team-performance"],
    ["client-braz", "team-content"],
    ["client-braz", "team-performance"],
    ["client-moara", "team-content"],
    ["client-moara", "team-strategy"],
    ["client-copa", "team-content"],
    ["client-copa", "team-performance"],
  ];
  for (const relation of clientTeams) {
    statements.push(
      db
        .prepare("INSERT OR IGNORE INTO client_teams (client_id, team_id) VALUES (?, ?)")
        .bind(...relation),
    );
  }

  const tasks = [
    ["task-calendar", "client-madruga", "Calendário de conteúdo de setembro", "Organizar temas, formatos e responsáveis para as próximas quatro semanas.", "collective", "in_progress", "high", addDays(today, 2)],
    ["task-meta-braz", "client-braz", "Revisar campanha de conversão", "Checar criativos, públicos e orçamento antes da nova rodada no Meta Ads.", "individual", "review", "urgent", addDays(today, 1)],
    ["task-photo-rostbif", "client-rostbif", "Produzir fotos do novo combo", "Finalizar seleção, tratamento e exportação das imagens para feed e cardápio.", "collective", "pending", "high", today],
    ["task-landing-moara", "client-moara", "Ajustar landing page de reservas", "Atualizar provas sociais e revisar o CTA principal da página.", "individual", "in_progress", "normal", addDays(today, 5)],
    ["task-copa-creative", "client-copa", "Criativo antes e depois", "Criar variação vertical com transformação do estofado e CTA de orçamento.", "individual", "pending", "urgent", addDays(today, -2)],
    ["task-report", "client-madruga", "Relatório semanal de performance", "Consolidar alcance, leads, investimento e próximos testes.", "collective", "pending", "normal", addDays(today, 3)],
    ["task-copy-rostbif", "client-rostbif", "Legenda da campanha Carne de Verdade", "Legenda aprovada e encaminhada para publicação.", "individual", "completed", "normal", addDays(today, -5)],
  ] as const;

  for (const task of tasks) {
    const isCompleted = task[5] === "completed";
    statements.push(
      db
        .prepare(
          `INSERT INTO tasks
            (id, workspace_id, client_id, title, description, assignment_type, status, priority,
             created_by, created_at, due_at, started_at, completed_at, archived_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          task[0],
          WORKSPACE_ID,
          task[1],
          task[2],
          task[3],
          task[4],
          task[5],
          task[6],
          owner.id,
          createdAt,
          task[7],
          task[5] === "pending" ? null : createdAt,
          isCompleted ? createdAt : null,
          isCompleted ? createdAt : null,
          createdAt,
        ),
    );
  }

  const taskAssignees = [
    ["task-calendar", "user-ana"],
    ["task-calendar", "user-lucas"],
    ["task-meta-braz", "user-marina"],
    ["task-photo-rostbif", "user-lucas"],
    ["task-landing-moara", "user-lucas"],
    ["task-copa-creative", "user-lucas"],
    ["task-report", "user-rafael"],
    ["task-copy-rostbif", "user-ana"],
  ];
  for (const relation of taskAssignees) {
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO task_assignees (task_id, user_id, responsibility) VALUES (?, ?, 'responsible')",
        )
        .bind(...relation),
    );
  }
  const taskTeams = [
    ["task-calendar", "team-content"],
    ["task-photo-rostbif", "team-content"],
    ["task-report", "team-performance"],
  ];
  for (const relation of taskTeams) {
    statements.push(
      db
        .prepare("INSERT OR IGNORE INTO task_teams (task_id, team_id) VALUES (?, ?)")
        .bind(...relation),
    );
  }

  const routines = [
    ["routine-weekly-report", "client-madruga", "Relatório semanal de performance", "Consolidar indicadores, aprendizados e próximos testes.", "collective", "weekly", "1", addDays(today, 7), "team-performance", null],
    ["routine-monthly-plan", "client-moara", "Planejamento mensal de conteúdo", "Preparar pauta, referências e calendário do próximo mês.", "collective", "monthly", "25", addDays(today, 14), "team-content", null],
    ["routine-comments", "client-rostbif", "Monitorar comentários e avaliações", "Responder interações prioritárias e sinalizar oportunidades.", "individual", "daily", "1", addDays(today, 1), null, "user-ana"],
  ] as const;
  for (const routine of routines) {
    statements.push(
      db
        .prepare(
          `INSERT INTO routines
            (id, workspace_id, client_id, title, description, assignment_type, frequency,
             interval_value, weekdays, day_of_month, due_offset_days, next_run_at, starts_at,
             active, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?, ?, 1, ?, ?)`,
        )
        .bind(
          routine[0],
          WORKSPACE_ID,
          routine[1],
          routine[2],
          routine[3],
          routine[4],
          routine[5],
          routine[5] === "weekly" ? routine[6] : null,
          routine[5] === "monthly" ? Number(routine[6]) : null,
          routine[7],
          today,
          owner.id,
          createdAt,
        ),
    );
    if (routine[8]) {
      statements.push(
        db
          .prepare("INSERT INTO routine_teams (routine_id, team_id) VALUES (?, ?)")
          .bind(routine[0], routine[8]),
      );
    }
    if (routine[9]) {
      statements.push(
        db
          .prepare("INSERT INTO routine_assignees (routine_id, user_id) VALUES (?, ?)")
          .bind(routine[0], routine[9]),
      );
    }
  }

  statements.push(
    db
      .prepare(
        "INSERT INTO task_comments (id, task_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        "comment-initial",
        "task-meta-braz",
        "user-marina",
        "A campanha já está com as duas novas variações. Falta apenas a checagem final do orçamento.",
        createdAt,
      ),
    db
      .prepare(
        "INSERT INTO task_events (id, task_id, actor_id, event_type, from_value, to_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "event-initial",
        "task-meta-braz",
        owner.id,
        "status_changed",
        "in_progress",
        "review",
        createdAt,
      ),
    db
      .prepare(
        "INSERT INTO notifications (id, user_id, task_id, title, message, kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "notification-initial",
        owner.id,
        "task-meta-braz",
        "Demanda aguardando checagem",
        "A campanha de conversão da Braz Cosmética está pronta para revisão.",
        "review",
        createdAt,
      ),
  );

  await db.batch(statements);
}

function nextRoutineDate(routine: Routine, current: string): string {
  if (routine.frequency === "daily") {
    return addDays(current, Math.max(1, routine.interval_value));
  }

  if (routine.frequency === "weekly") {
    const allowed = (routine.weekdays || "1")
      .split(",")
      .map(Number)
      .filter((value) => value >= 0 && value <= 6);
    for (let offset = 1; offset <= 28; offset += 1) {
      const candidate = addDays(current, offset);
      const day = new Date(`${candidate}T12:00:00Z`).getUTCDay();
      if (allowed.includes(day)) return candidate;
    }
    return addDays(current, 7 * Math.max(1, routine.interval_value));
  }

  const source = new Date(`${current}T12:00:00Z`);
  const targetMonth = source.getUTCMonth() + Math.max(1, routine.interval_value);
  const year = source.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const requestedDay = routine.day_of_month ?? 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(requestedDay, lastDay);
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export async function materializeDueRoutines(user: AppUser): Promise<void> {
  if (user.role === "collaborator") return;
  const db = getD1();
  const today = localDate();
  const due = await rows<Routine>(
    db
      .prepare(
        `SELECT r.* FROM routines r
         JOIN clients c ON c.id = r.client_id
         WHERE r.workspace_id = ? AND r.active = 1 AND c.status = 'active' AND r.next_run_at <= ?
         ORDER BY r.next_run_at LIMIT 30`,
      )
      .bind(WORKSPACE_ID, today),
  );

  for (const routine of due) {
    let occurrence = routine.next_run_at;
    let iterations = 0;
    while (occurrence <= today && iterations < 30) {
      if (routine.ends_at && occurrence > routine.ends_at) {
        await db
          .prepare("UPDATE routines SET active = 0 WHERE id = ?")
          .bind(routine.id)
          .run();
        break;
      }

      const taskId = `task-occurrence-${routine.id}-${occurrence}`;
      const timestamp = nowIso();
      const assignees = await rows<{ user_id: string }>(
        db
          .prepare("SELECT user_id FROM routine_assignees WHERE routine_id = ?")
          .bind(routine.id),
      );
      const teams = await rows<{ team_id: string }>(
        db
          .prepare("SELECT team_id FROM routine_teams WHERE routine_id = ?")
          .bind(routine.id),
      );
      const statements: D1PreparedStatement[] = [
        db
          .prepare(
            `INSERT OR IGNORE INTO tasks
              (id, workspace_id, client_id, routine_id, occurrence_key, title, description,
               assignment_type, status, priority, created_by, created_at, due_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'normal', ?, ?, ?, ?)`,
          )
          .bind(
            taskId,
            WORKSPACE_ID,
            routine.client_id,
            routine.id,
            occurrence,
            routine.title,
            routine.description,
            routine.assignment_type,
            routine.created_by,
            timestamp,
            addDays(occurrence, routine.due_offset_days),
            timestamp,
          ),
        db
          .prepare(
            "INSERT OR IGNORE INTO task_events (id, task_id, actor_id, event_type, to_value, created_at) VALUES (?, ?, ?, 'routine_generated', ?, ?)",
          )
          .bind(
            `event-${routine.id}-${occurrence}`,
            taskId,
            routine.created_by,
            routine.id,
            timestamp,
          ),
      ];
      for (const assignee of assignees) {
        statements.push(
          db
            .prepare(
              "INSERT OR IGNORE INTO task_assignees (task_id, user_id, responsibility) VALUES (?, ?, 'responsible')",
            )
            .bind(taskId, assignee.user_id),
          db
            .prepare(
              "INSERT OR IGNORE INTO notifications (id, user_id, task_id, title, message, kind, created_at) VALUES (?, ?, ?, ?, ?, 'assignment', ?)",
            )
            .bind(
              `notification-${routine.id}-${occurrence}-${assignee.user_id}`,
              assignee.user_id,
              taskId,
              "Nova rotina gerada",
              routine.title,
              timestamp,
            ),
        );
      }
      for (const team of teams) {
        statements.push(
          db
            .prepare("INSERT OR IGNORE INTO task_teams (task_id, team_id) VALUES (?, ?)")
            .bind(taskId, team.team_id),
        );
      }
      const next = nextRoutineDate(routine, occurrence);
      statements.push(
        db.prepare("UPDATE routines SET next_run_at = ? WHERE id = ?").bind(next, routine.id),
      );
      await db.batch(statements);
      occurrence = next;
      iterations += 1;
    }
  }
}

export async function canAccessTask(
  user: AppUser,
  taskId: string,
): Promise<boolean> {
  if (user.role === "owner" || user.role === "manager") return true;
  const db = getD1();
  const result = await db
    .prepare(
      `SELECT 1 AS allowed
       FROM tasks t
       WHERE t.id = ? AND t.workspace_id = ? AND (
         t.created_by = ?
         OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)
         OR EXISTS (
           SELECT 1 FROM task_teams tt
           JOIN team_members tm ON tm.team_id = tt.team_id
           WHERE tt.task_id = t.id AND tm.user_id = ?
         )
       ) LIMIT 1`,
    )
    .bind(taskId, WORKSPACE_ID, user.id, user.id, user.id)
    .first<{ allowed: number }>();
  return Boolean(result?.allowed);
}

export function canManage(user: AppUser): boolean {
  return user.role === "owner" || user.role === "manager";
}

export async function getAppData(user: AppUser): Promise<AppData> {
  const db = getD1();
  await materializeDueRoutines(user);

  const [
    allClients,
    users,
    teams,
    allTasks,
    routines,
    salesOpportunities,
    salesMeetings,
    salesContracts,
    rawTeamMembers,
    rawClientTeams,
    rawTaskAssignees,
    rawTaskTeams,
    rawRoutineAssignees,
    rawRoutineTeams,
    allComments,
    allEvents,
    allAttachments,
    notifications,
  ] = await Promise.all([
    rows<Client>(db.prepare("SELECT * FROM clients WHERE workspace_id = ? ORDER BY name").bind(WORKSPACE_ID)),
    rows<AppUser>(db.prepare("SELECT * FROM users WHERE workspace_id = ? ORDER BY active DESC, name").bind(WORKSPACE_ID)),
    rows<Team>(db.prepare("SELECT * FROM teams WHERE workspace_id = ? ORDER BY name").bind(WORKSPACE_ID)),
    rows<Task>(db.prepare("SELECT * FROM tasks WHERE workspace_id = ? ORDER BY due_at, created_at DESC").bind(WORKSPACE_ID)),
    rows<Routine>(db.prepare("SELECT * FROM routines WHERE workspace_id = ? ORDER BY active DESC, next_run_at").bind(WORKSPACE_ID)),
    rows<SalesOpportunity>(db.prepare("SELECT * FROM sales_opportunities WHERE workspace_id = ? ORDER BY updated_at DESC").bind(WORKSPACE_ID)),
    rows<SalesMeeting>(db.prepare("SELECT * FROM sales_meetings WHERE workspace_id = ? ORDER BY starts_at").bind(WORKSPACE_ID)),
    rows<SalesContract>(db.prepare("SELECT * FROM sales_contracts WHERE workspace_id = ? ORDER BY updated_at DESC").bind(WORKSPACE_ID)),
    rows<{ team_id: string; user_id: string }>(db.prepare("SELECT team_id, user_id FROM team_members")),
    rows<{ client_id: string; team_id: string }>(db.prepare("SELECT client_id, team_id FROM client_teams")),
    rows<{ task_id: string; user_id: string }>(db.prepare("SELECT task_id, user_id FROM task_assignees")),
    rows<{ task_id: string; team_id: string }>(db.prepare("SELECT task_id, team_id FROM task_teams")),
    rows<{ routine_id: string; user_id: string }>(db.prepare("SELECT routine_id, user_id FROM routine_assignees")),
    rows<{ routine_id: string; team_id: string }>(db.prepare("SELECT routine_id, team_id FROM routine_teams")),
    rows<TaskComment>(db.prepare("SELECT * FROM task_comments ORDER BY created_at")),
    rows<TaskEvent>(db.prepare("SELECT * FROM task_events ORDER BY created_at DESC")),
    rows<Attachment>(db.prepare("SELECT id, task_id, user_id, file_name, content_type, size, created_at FROM attachments ORDER BY created_at DESC")),
    rows<Notification>(db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30").bind(user.id)),
  ]);

  const managed = canManage(user);
  const memberTeamIds = new Set(
    rawTeamMembers.filter((item) => item.user_id === user.id).map((item) => item.team_id),
  );
  const directTaskIds = new Set(
    rawTaskAssignees.filter((item) => item.user_id === user.id).map((item) => item.task_id),
  );
  const teamTaskIds = new Set(
    rawTaskTeams.filter((item) => memberTeamIds.has(item.team_id)).map((item) => item.task_id),
  );
  const visibleTasks = managed
    ? allTasks
    : allTasks.filter(
        (task) =>
          task.created_by === user.id ||
          directTaskIds.has(task.id) ||
          teamTaskIds.has(task.id),
      );
  const taskIds = new Set(visibleTasks.map((task) => task.id));
  const teamClientIds = new Set(
    rawClientTeams
      .filter((item) => memberTeamIds.has(item.team_id))
      .map((item) => item.client_id),
  );
  const taskClientIds = new Set(visibleTasks.map((task) => task.client_id));
  const visibleClients = managed
    ? allClients
    : allClients.filter(
        (client) => teamClientIds.has(client.id) || taskClientIds.has(client.id),
      );
  const clientIds = new Set(visibleClients.map((client) => client.id));
  const visibleRoutines = managed
    ? routines
    : routines.filter((routine) => clientIds.has(routine.client_id));
  const visibleOpportunities = managed
    ? salesOpportunities
    : salesOpportunities.filter((opportunity) => opportunity.owner_id === user.id);
  const visibleOpportunityIds = new Set(visibleOpportunities.map((item) => item.id));
  const visibleMeetings = managed
    ? salesMeetings
    : salesMeetings.filter(
        (meeting) =>
          meeting.responsible_id === user.id ||
          Boolean(meeting.opportunity_id && visibleOpportunityIds.has(meeting.opportunity_id)),
      );
  const visibleContracts = managed
    ? salesContracts
    : salesContracts.filter(
        (contract) =>
          contract.owner_id === user.id ||
          Boolean(contract.opportunity_id && visibleOpportunityIds.has(contract.opportunity_id)),
      );

  const pair = (leftId: string, rightId: string): Pair => ({
    left_id: leftId,
    right_id: rightId,
  });

  return {
    currentUser: user,
    clients: visibleClients,
    users,
    teams: managed ? teams : teams.filter((team) => memberTeamIds.has(team.id)),
    tasks: visibleTasks,
    routines: visibleRoutines,
    salesOpportunities: visibleOpportunities,
    salesMeetings: visibleMeetings,
    salesContracts: visibleContracts,
    teamMembers: rawTeamMembers.map((item) => pair(item.team_id, item.user_id)),
    clientTeams: rawClientTeams.map((item) => pair(item.client_id, item.team_id)),
    taskAssignees: rawTaskAssignees
      .filter((item) => taskIds.has(item.task_id))
      .map((item) => pair(item.task_id, item.user_id)),
    taskTeams: rawTaskTeams
      .filter((item) => taskIds.has(item.task_id))
      .map((item) => pair(item.task_id, item.team_id)),
    routineAssignees: rawRoutineAssignees.map((item) =>
      pair(item.routine_id, item.user_id),
    ),
    routineTeams: rawRoutineTeams.map((item) =>
      pair(item.routine_id, item.team_id),
    ),
    comments: allComments.filter((item) => taskIds.has(item.task_id)),
    events: allEvents.filter((item) => taskIds.has(item.task_id)),
    attachments: allAttachments.filter((item) => taskIds.has(item.task_id)),
    notifications,
  };
}
