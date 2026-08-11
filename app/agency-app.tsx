"use client";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat2,
  RotateCcw,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Trash2,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  AppData,
  AppUser,
  Client,
  Priority,
  Routine,
  Task,
  TaskStatus,
  Team,
} from "./lib/types";

type View = "dashboard" | "tasks" | "clients" | "team" | "routines" | "archive";
type ModalName = "task" | "client" | "deactivate_client" | "member" | "team" | "routine" | null;
type ActionPayload = Record<string, unknown> & { action: string };

const navItems: Array<{
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "tasks", label: "Minhas demandas", icon: ClipboardList },
  { id: "clients", label: "Clientes", icon: Building2 },
  { id: "team", label: "Equipe", icon: Users },
  { id: "routines", label: "Rotinas", icon: Repeat2 },
  { id: "archive", label: "Arquivo", icon: Archive },
];

const statusMeta: Record<
  TaskStatus,
  { label: string; short: string; className: string; dot: string }
> = {
  pending: {
    label: "Pendente",
    short: "Pendente",
    className: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
  },
  in_progress: {
    label: "Em andamento",
    short: "Andamento",
    className: "bg-blue-50 text-blue-700",
    dot: "bg-[#0069FE]",
  },
  review: {
    label: "Em checagem",
    short: "Checagem",
    className: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Concluída",
    short: "Concluída",
    className: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
};

const priorityMeta: Record<Priority, { label: string; className: string }> = {
  low: { label: "Baixa", className: "text-slate-500" },
  normal: { label: "Normal", className: "text-slate-600" },
  high: { label: "Alta", className: "text-orange-600" },
  urgent: { label: "Urgente", className: "text-rose-600" },
};

function formatDate(date: string | null | undefined, compact = false) {
  if (!date) return "—";
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", compact
    ? { day: "2-digit", month: "short" }
    : { day: "2-digit", month: "long", year: "numeric" }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
}

function addDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function dueLabel(task: Task) {
  if (task.archived_at) return `Concluída em ${formatDate(task.completed_at?.slice(0, 10), true)}`;
  const today = dateKey();
  if (task.due_at < today) return `Atrasada desde ${formatDate(task.due_at, true)}`;
  if (task.due_at === today) return "Entrega hoje";
  if (task.due_at === addDate(1)) return "Entrega amanhã";
  return `Entrega ${formatDate(task.due_at, true)}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

function frequencyLabel(routine: Routine) {
  if (routine.frequency === "daily") return "Todos os dias";
  if (routine.frequency === "weekly") {
    const labels = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    const days = (routine.weekdays || "1")
      .split(",")
      .map(Number)
      .map((day) => labels[day])
      .join(", ");
    return `Semanal · ${days}`;
  }
  return `Todo dia ${routine.day_of_month ?? 1}`;
}

function roleLabel(role: AppUser["role"]) {
  if (role === "owner") return "Proprietário";
  if (role === "manager") return "Gestor";
  return "Colaborador";
}

function Avatar({ user, size = "md" }: { user: AppUser; size?: "sm" | "md" | "lg" }) {
  const sizeClass =
    size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizeClass}`}
      style={{ backgroundColor: user.avatar_color }}
      title={user.name}
    >
      {initials(user.name)}
    </span>
  );
}

function getClient(data: AppData, id: string) {
  return data.clients.find((client) => client.id === id);
}

function getUser(data: AppData, id: string) {
  return data.users.find((user) => user.id === id);
}

function getTeam(data: AppData, id: string) {
  return data.teams.find((team) => team.id === id);
}

function taskUsers(data: AppData, taskId: string) {
  const ids = data.taskAssignees
    .filter((pair) => pair.left_id === taskId)
    .map((pair) => pair.right_id);
  return data.users.filter((user) => ids.includes(user.id));
}

function taskTeamList(data: AppData, taskId: string) {
  const ids = data.taskTeams
    .filter((pair) => pair.left_id === taskId)
    .map((pair) => pair.right_id);
  return data.teams.filter((team) => ids.includes(team.id));
}

function taskResponsibleUsers(data: AppData, taskId: string) {
  const directUserIds = data.taskAssignees
    .filter((pair) => pair.left_id === taskId)
    .map((pair) => pair.right_id);
  const assignedTeamIds = new Set(
    data.taskTeams
      .filter((pair) => pair.left_id === taskId)
      .map((pair) => pair.right_id),
  );
  const teamUserIds = data.teamMembers
    .filter((pair) => assignedTeamIds.has(pair.left_id))
    .map((pair) => pair.right_id);
  const responsibleIds = new Set([...directUserIds, ...teamUserIds]);
  return data.users.filter((user) => responsibleIds.has(user.id));
}

export function AgencyApp() {
  const [data, setData] = useState<AppData | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [search, setSearch] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [memberToRemoveId, setMemberToRemoveId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      const result = (await response.json()) as AppData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Falha ao carregar dados.");
      setData(result);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar dados.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runAction = useCallback(
    async (payload: ActionPayload, successMessage?: string) => {
      setWorking(true);
      try {
        const response = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || "Não foi possível concluir a ação.");
        await loadData(true);
        if (successMessage) setToast(successMessage);
        return true;
      } catch (cause) {
        setToast(cause instanceof Error ? cause.message : "Não foi possível concluir a ação.");
        return false;
      } finally {
        setWorking(false);
      }
    },
    [loadData],
  );

  const selectView = (next: View) => {
    setView(next);
    setSelectedClientId(null);
    setMobileNav(false);
  };

  const activeTasks = useMemo(
    () => data?.tasks.filter((task) => !task.archived_at) ?? [],
    [data],
  );
  const unread = data?.notifications.filter((item) => !item.read_at).length ?? 0;

  if (loading) return <LoadingScreen />;
  if (!data || error) return <ErrorScreen message={error} onRetry={() => void loadData()} />;

  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const canManage = data.currentUser.role !== "collaborator";

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#14213d]">
      <Sidebar
        currentUser={data.currentUser}
        view={view}
        mobileOpen={mobileNav}
        onClose={() => setMobileNav(false)}
        onSelect={selectView}
        activeCount={activeTasks.length}
      />

      <div className="lg:pl-[252px]">
        <Topbar
          data={data}
          search={search}
          onSearch={setSearch}
          onMenu={() => setMobileNav(true)}
          notificationsOpen={notificationsOpen}
          onNotifications={async () => {
            const willOpen = !notificationsOpen;
            setNotificationsOpen(willOpen);
            if (willOpen && unread) {
              await runAction({ action: "mark_notifications_read" });
            }
          }}
          unread={unread}
          onTask={(id) => {
            setSelectedTaskId(id);
            setNotificationsOpen(false);
          }}
        />

        <main className="mx-auto max-w-[1540px] px-4 pb-12 pt-5 sm:px-6 lg:px-8 lg:pt-7">
          {view === "dashboard" && (
            <DashboardView
              data={data}
              tasks={activeTasks}
              search={search}
              onOpenTask={setSelectedTaskId}
              onNewTask={() => {
                setEditingTask(null);
                setModal("task");
              }}
              onViewTasks={() => setView("tasks")}
              onOpenClient={(id) => {
                setView("clients");
                setSelectedClientId(id);
              }}
            />
          )}
          {view === "tasks" && (
            <TasksView
              data={data}
              search={search}
              onOpenTask={setSelectedTaskId}
              onNewTask={() => {
                setEditingTask(null);
                setModal("task");
              }}
            />
          )}
          {view === "clients" && (
            <ClientsView
              data={data}
              search={search}
              canManage={canManage}
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
              onBack={() => setSelectedClientId(null)}
              onOpenTask={setSelectedTaskId}
              onNewClient={() => setModal("client")}
              onDeactivate={() => setModal("deactivate_client")}
              onReactivate={(client) =>
                void runAction(
                  { action: "reactivate_client", id: client.id },
                  "Cliente reativado. Revise as rotinas que permaneceram pausadas.",
                )
              }
              onNewTask={() => {
                setEditingTask(null);
                setModal("task");
              }}
            />
          )}
          {view === "team" && (
            <TeamView
              data={data}
              search={search}
              canManage={canManage}
              onNewMember={() => setModal("member")}
              onNewTeam={() => {
                setEditingTeam(null);
                setModal("team");
              }}
              onEditTeam={(team) => {
                setEditingTeam(team);
                setModal("team");
              }}
              onRole={(id, role) =>
                void runAction(
                  { action: "update_member_role", id, role },
                  "Perfil atualizado.",
                )
              }
              onRemove={(member) => setMemberToRemoveId(member.id)}
            />
          )}
          {view === "routines" && (
            <RoutinesView
              data={data}
              search={search}
              canManage={canManage}
              onNew={() => setModal("routine")}
              onToggle={(routine) =>
                void runAction(
                  { action: "toggle_routine", id: routine.id, active: !routine.active },
                  routine.active ? "Rotina pausada." : "Rotina reativada.",
                )
              }
            />
          )}
          {view === "archive" && (
            <ArchiveView
              data={data}
              search={search}
              onOpenTask={setSelectedTaskId}
              onReopen={(task) =>
                void runAction(
                  { action: "update_status", id: task.id, status: "in_progress" },
                  "Demanda reaberta e devolvida ao fluxo ativo.",
                )
              }
            />
          )}
        </main>
      </div>

      {selectedTask && (
        <TaskDrawer
          data={data}
          task={selectedTask}
          working={working}
          onClose={() => setSelectedTaskId(null)}
          onRefresh={() => loadData(true)}
          onToast={setToast}
          onEdit={() => {
            setEditingTask(selectedTask);
            setModal("task");
          }}
          onAction={runAction}
        />
      )}

      {modal === "task" && (
        <TaskModal
          data={data}
          task={editingTask}
          working={working}
          initialClientId={selectedClientId}
          onClose={() => {
            setModal(null);
            setEditingTask(null);
          }}
          onSubmit={async (payload) => {
            const ok = await runAction(
              payload,
              editingTask ? "Demanda atualizada." : "Nova demanda criada.",
            );
            if (ok) {
              setModal(null);
              setEditingTask(null);
            }
          }}
        />
      )}
      {modal === "client" && (
        <ClientModal
          working={working}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            const ok = await runAction(payload, "Cliente cadastrado.");
            if (ok) setModal(null);
          }}
        />
      )}
      {modal === "deactivate_client" && selectedClientId && data.clients.find((client) => client.id === selectedClientId) && (
        <DeactivateClientModal
          client={data.clients.find((client) => client.id === selectedClientId) as Client}
          working={working}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            const ok = await runAction(payload, "Cliente retirado do escopo e rotinas pausadas.");
            if (ok) setModal(null);
          }}
        />
      )}
      {modal === "member" && (
        <MemberModal
          data={data}
          working={working}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            const ok = await runAction(payload, "Acesso liberado para o colaborador.");
            if (ok) setModal(null);
          }}
        />
      )}
      {memberToRemoveId && data.users.find((user) => user.id === memberToRemoveId) && (
        <RemoveMemberModal
          member={data.users.find((user) => user.id === memberToRemoveId) as AppUser}
          working={working}
          onClose={() => setMemberToRemoveId(null)}
          onSubmit={async (payload) => {
            const ok = await runAction(
              payload,
              "Acesso removido. O histórico do colaborador foi preservado.",
            );
            if (ok) setMemberToRemoveId(null);
          }}
        />
      )}
      {modal === "team" && (
        <TeamModal
          data={data}
          team={editingTeam}
          working={working}
          onClose={() => {
            setModal(null);
            setEditingTeam(null);
          }}
          onSubmit={async (payload) => {
            const ok = await runAction(
              payload,
              payload.action === "delete_team"
                ? "Equipe excluída. Pessoas, demandas e histórico foram preservados."
                : editingTeam
                  ? "Equipe atualizada."
                  : "Equipe criada.",
            );
            if (ok) {
              setModal(null);
              setEditingTeam(null);
            }
          }}
        />
      )}
      {modal === "routine" && (
        <RoutineModal
          data={data}
          working={working}
          initialClientId={selectedClientId}
          onClose={() => setModal(null)}
          onSubmit={async (payload) => {
            const ok = await runAction(payload, "Rotina criada e ativada.");
            if (ok) setModal(null);
          }}
        />
      )}

      {working && (
        <div className="fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#00113B] px-4 py-2.5 text-sm font-medium text-white shadow-xl">
          <LoaderCircle className="animate-spin" size={16} /> Salvando…
        </div>
      )}
      {toast && (
        <div className="app-enter fixed bottom-5 right-5 z-[100] max-w-sm rounded-2xl bg-[#00113B] px-4 py-3 text-sm font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00113B] text-white shadow-xl shadow-blue-950/15">
          <LoaderCircle className="animate-spin" size={24} />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-600">Organizando sua operação…</p>
      </div>
    </main>
  );
}

function ErrorScreen({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-5">
      <div className="max-w-md rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-xl">
        <AlertTriangle className="mx-auto text-rose-500" size={32} />
        <h1 className="mt-4 text-xl font-semibold text-[#00113B]">Não foi possível abrir a central</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message || "Tente novamente em instantes."}</p>
        <button
          className="mt-6 rounded-xl bg-[#0069FE] px-5 py-2.5 text-sm font-semibold text-white"
          onClick={onRetry}
          type="button"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}

function Sidebar({
  currentUser,
  view,
  mobileOpen,
  onClose,
  onSelect,
  activeCount,
}: {
  currentUser: AppUser;
  view: View;
  mobileOpen: boolean;
  onClose: () => void;
  onSelect: (view: View) => void;
  activeCount: number;
}) {
  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-[#00113B]/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          type="button"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col overflow-hidden bg-[#00113B] text-white transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[78px] items-center justify-between border-b border-white/10 px-5">
          <button className="flex items-center gap-3 text-left" onClick={() => onSelect("dashboard")} type="button">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0069FE] font-semibold shadow-lg shadow-blue-950/30">
              T
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight">Traço Operações</span>
              <span className="block text-[11px] text-blue-100/60">Central da agência</span>
            </span>
          </button>
          <button aria-label="Fechar menu" className="rounded-lg p-2 text-white/70 lg:hidden" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <nav className="app-scrollbar flex-1 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-100/40">
            Operação
          </p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-white text-[#00113B] shadow-sm"
                      : "text-blue-50/70 hover:bg-white/8 hover:text-white"
                  }`}
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  type="button"
                >
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.id === "tasks" && activeCount > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-blue-50 text-[#0069FE]" : "bg-white/10 text-white/70"}`}>
                      {activeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mx-3 my-6 h-px bg-white/10" />
          <div className="mx-1 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-50">
              <Sparkles size={14} className="text-[#5ba2ff]" /> Operação centralizada
            </div>
            <p className="mt-2 text-[11px] leading-5 text-blue-100/55">
              Clientes, prazos, arquivos e histórico ficam registrados no mesmo fluxo.
            </p>
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Avatar user={currentUser} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{currentUser.name}</p>
              <p className="truncate text-[10px] text-blue-100/50">{roleLabel(currentUser.role)}</p>
            </div>
            <Settings2 size={16} className="text-blue-100/45" />
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  data,
  search,
  onSearch,
  onMenu,
  notificationsOpen,
  onNotifications,
  unread,
  onTask,
}: {
  data: AppData;
  search: string;
  onSearch: (value: string) => void;
  onMenu: () => void;
  notificationsOpen: boolean;
  onNotifications: () => void;
  unread: number;
  onTask: (id: string) => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1540px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button aria-label="Abrir menu" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden" onClick={onMenu} type="button">
          <Menu size={19} />
        </button>
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            aria-label="Buscar demandas e clientes"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-[#14213d] placeholder:text-slate-400 focus:border-[#0069FE] focus:bg-white focus:outline-none"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar demandas, clientes ou responsáveis…"
            value={search}
          />
        </div>
        <div className="relative">
          <button
            aria-label="Notificações"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            onClick={onNotifications}
            type="button"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#0069FE] ring-2 ring-white" />
            )}
          </button>
          {notificationsOpen && (
            <div className="app-enter absolute right-0 top-12 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/10">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#00113B]">Notificações</p>
                  <p className="text-[11px] text-slate-500">Atualizações recentes da operação</p>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-[#0069FE]">{data.notifications.length}</span>
              </div>
              <div className="app-scrollbar max-h-[420px] overflow-y-auto p-2">
                {data.notifications.length ? (
                  data.notifications.slice(0, 10).map((notification) => (
                    <button
                      className="flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                      key={notification.id}
                      onClick={() => notification.task_id && onTask(notification.task_id)}
                      type="button"
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0069FE]" />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-[#14213d]">{notification.title}</span>
                        <span className="mt-0.5 block text-[11px] leading-5 text-slate-500">{notification.message}</span>
                        <span className="mt-1 block text-[10px] text-slate-400">{formatDateTime(notification.created_at)}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-slate-500">
                    <Inbox className="mx-auto mb-2 text-slate-300" size={24} />
                    Nenhuma notificação por aqui.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 sm:flex">
          <Avatar user={data.currentUser} size="sm" />
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>
    </header>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0069FE]">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-[#00113B] sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function PrimaryButton({ children, onClick, icon: Icon = Plus, type = "button", disabled = false }: {
  children: ReactNode;
  onClick?: () => void;
  icon?: typeof Plus;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0069FE] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-500/15 transition hover:bg-[#0058d6] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      <Icon size={16} /> {children}
    </button>
  );
}

function DashboardView({
  data,
  tasks,
  search,
  onOpenTask,
  onNewTask,
  onViewTasks,
  onOpenClient,
}: {
  data: AppData;
  tasks: Task[];
  search: string;
  onOpenTask: (id: string) => void;
  onNewTask: () => void;
  onViewTasks: () => void;
  onOpenClient: (id: string) => void;
}) {
  const today = dateKey();
  const filtered = filterTasks(data, tasks, search);
  const overdue = tasks.filter((task) => task.due_at < today).length;
  const dueToday = tasks.filter((task) => task.due_at === today).length;
  const review = tasks.filter((task) => task.status === "review").length;
  const completedThisMonth = data.tasks.filter(
    (task) => task.completed_at?.slice(0, 7) === today.slice(0, 7),
  ).length;
  const priorities = [...filtered]
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
    .slice(0, 6);
  const clientProgress = data.clients.filter((client) => client.status === "active").map((client) => {
    const clientTasks = tasks.filter((task) => task.client_id === client.id);
    const allClient = data.tasks.filter((task) => task.client_id === client.id);
    const completed = allClient.filter((task) => task.status === "completed").length;
    const progress = allClient.length ? Math.round((completed / allClient.length) * 100) : 0;
    return { client, active: clientTasks.length, progress };
  });

  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <div className="app-enter">
      <PageHeader
        eyebrow={dateLabel}
        title={`Bom dia, ${firstName(data.currentUser.name)}.`}
        description="Aqui está o que precisa da sua atenção para manter a operação avançando."
        action={<PrimaryButton onClick={onNewTask}>Nova demanda</PrimaryButton>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da operação">
        <MetricCard label="Demandas ativas" value={tasks.length} note={`${dueToday} para hoje`} icon={ListChecks} tone="blue" />
        <MetricCard label="Em checagem" value={review} note="Aguardando aprovação" icon={Eye} tone="amber" />
        <MetricCard label="Atrasadas" value={overdue} note={overdue ? "Precisam de atenção" : "Tudo em dia"} icon={AlertTriangle} tone="rose" />
        <MetricCard label="Concluídas no mês" value={completedThisMonth} note="Histórico preservado" icon={CheckCircle2} tone="green" />
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.85fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.02]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-[#00113B]">Prioridades da operação</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Ordenadas pelo prazo de entrega</p>
            </div>
            <button className="flex items-center gap-1 text-xs font-semibold text-[#0069FE]" onClick={onViewTasks} type="button">
              Ver quadro <ChevronRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {priorities.length ? priorities.map((task) => (
              <TaskRow data={data} key={task.id} task={task} onOpen={() => onOpenTask(task.id)} />
            )) : (
              <EmptyState compact icon={CheckCircle2} title="Nada pendente" description="Todas as demandas filtradas foram concluídas." />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#00113B]">Ritmo por cliente</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Visão consolidada da carteira</p>
            </div>
            <TrendingUp size={18} className="text-[#0069FE]" />
          </div>
          <div className="mt-5 space-y-4">
            {clientProgress.map(({ client, active, progress }) => (
              <button className="block w-full text-left" key={client.id} onClick={() => onOpenClient(client.id)} type="button">
                <div className="flex items-center gap-3">
                  <span className="h-9 w-1 rounded-full" style={{ backgroundColor: client.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-xs font-semibold text-[#14213d]">{client.name}</p>
                      <p className="text-[10px] font-medium text-slate-500">{active} ativas</p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#0069FE]" style={{ width: `${Math.max(progress, 4)}%` }} />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl bg-[#00113B] px-5 py-5 text-white shadow-lg shadow-blue-950/10 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Repeat2 size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold">{data.routines.filter((routine) => routine.active).length} rotinas estão cuidando do trabalho repetitivo</p>
            <p className="mt-1 text-xs text-blue-100/60">As próximas ocorrências serão criadas automaticamente com responsáveis e prazo.</p>
          </div>
        </div>
        <button className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#71adff] sm:mt-0" onClick={() => onViewTasks()} type="button">
          Acompanhar fluxo <ArrowUpRight size={14} />
        </button>
      </section>
    </div>
  );
}

function MetricCard({ label, value, note, icon: Icon, tone }: {
  label: string;
  value: number;
  note: string;
  icon: typeof ListChecks;
  tone: "blue" | "amber" | "rose" | "green";
}) {
  const tones = {
    blue: "bg-blue-50 text-[#0069FE]",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    green: "bg-emerald-50 text-emerald-600",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.02]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[#00113B]">{value}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-[10px] font-medium text-slate-400">{note}</p>
    </article>
  );
}

function TaskRow({ data, task, onOpen }: { data: AppData; task: Task; onOpen: () => void }) {
  const client = getClient(data, task.client_id);
  const users = taskUsers(data, task.id);
  const overdue = !task.archived_at && task.due_at < dateKey();
  return (
    <button className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50" onClick={onOpen} type="button">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusMeta[task.status].dot}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[#14213d] group-hover:text-[#0069FE]">{task.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: client?.color }} />
          {client?.name ?? "Cliente"}
        </p>
      </div>
      <div className="hidden -space-x-1.5 sm:flex">
        {users.slice(0, 3).map((user) => <Avatar key={user.id} size="sm" user={user} />)}
      </div>
      <span className={`hidden rounded-lg px-2.5 py-1 text-[10px] font-semibold md:block ${statusMeta[task.status].className}`}>
        {statusMeta[task.status].short}
      </span>
      <span className={`w-24 text-right text-[10px] font-medium ${overdue ? "text-rose-600" : "text-slate-500"}`}>
        {dueLabel(task)}
      </span>
      <ChevronRight className="text-slate-300 group-hover:text-[#0069FE]" size={15} />
    </button>
  );
}

function filterTasks(data: AppData, tasks: Task[], search: string) {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  if (!query) return tasks;
  return tasks.filter((task) => {
    const client = getClient(data, task.client_id);
    const owners = taskResponsibleUsers(data, task.id).map((user) => user.name).join(" ");
    return `${task.title} ${task.description} ${client?.name ?? ""} ${owners}`
      .toLocaleLowerCase("pt-BR")
      .includes(query);
  });
}

function TasksView({ data, search, onOpenTask, onNewTask }: {
  data: AppData;
  search: string;
  onOpenTask: (id: string) => void;
  onNewTask: () => void;
}) {
  const [clientFilter, setClientFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const current = data.currentUser;
  const memberTeams = new Set(data.teamMembers.filter((pair) => pair.right_id === current.id).map((pair) => pair.left_id));
  const direct = new Set(data.taskAssignees.filter((pair) => pair.right_id === current.id).map((pair) => pair.left_id));
  const collective = new Set(data.taskTeams.filter((pair) => memberTeams.has(pair.right_id)).map((pair) => pair.left_id));
  const mine = data.tasks.filter((task) =>
    !task.archived_at &&
    (current.role === "owner" || current.role === "manager" || direct.has(task.id) || collective.has(task.id) || task.created_by === current.id),
  );
  const filtered = filterTasks(data, mine, search).filter(
    (task) =>
      (clientFilter === "all" || task.client_id === clientFilter) &&
      (priorityFilter === "all" || task.priority === priorityFilter) &&
      (agentFilter === "all" || taskResponsibleUsers(data, task.id).some((user) => user.id === agentFilter)),
  );
  const agents = data.users
    .filter((user) => user.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const columns: TaskStatus[] = ["pending", "in_progress", "review"];

  return (
    <div className="app-enter">
      <PageHeader
        eyebrow="Fluxo de trabalho"
        title="Minhas demandas"
        description="Acompanhe o trabalho do início à checagem. Ao concluir, a demanda será arquivada automaticamente."
        action={<PrimaryButton onClick={onNewTask}>Nova demanda</PrimaryButton>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect icon={Building2} value={clientFilter} onChange={setClientFilter}>
          <option value="all">Todos os clientes</option>
          {data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </FilterSelect>
        <FilterSelect icon={SlidersHorizontal} value={priorityFilter} onChange={setPriorityFilter}>
          <option value="all">Todas as prioridades</option>
          <option value="urgent">Urgente</option>
          <option value="high">Alta</option>
          <option value="normal">Normal</option>
          <option value="low">Baixa</option>
        </FilterSelect>
        <FilterSelect icon={UserRound} value={agentFilter} onChange={setAgentFilter}>
          <option value="all">Todos os agentes</option>
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </FilterSelect>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} demandas ativas</span>
      </div>
      <div className="app-scrollbar grid gap-4 overflow-x-auto pb-3 xl:grid-cols-3">
        {columns.map((status) => {
          const items = filtered.filter((task) => task.status === status);
          return (
            <section className="min-w-[300px] rounded-2xl border border-[#27282c] bg-[#0f1012] p-3" key={status}>
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${statusMeta[status].dot}`} />
                <h2 className="text-xs font-semibold text-[#14213d]">{statusMeta[status].label}</h2>
                <span className="ml-auto rounded-full border border-[#2b2d31] bg-[#1b1c20] px-2 py-0.5 text-[10px] font-semibold text-zinc-400">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((task) => (
                  <TaskCard data={data} key={task.id} task={task} onOpen={() => onOpenTask(task.id)} />
                ))}
                {!items.length && (
                  <div className="rounded-xl border border-dashed border-[#303238] bg-[#121316] px-4 py-8 text-center text-[11px] text-zinc-500">
                    Nenhuma demanda nesta etapa.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FilterSelect({ icon: Icon, value, onChange, children }: {
  icon: typeof Building2;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative inline-flex items-center">
      <Icon className="pointer-events-none absolute left-3 text-slate-400" size={14} />
      <select className="h-9 appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-xs font-medium text-slate-600 focus:border-[#0069FE] focus:outline-none" onChange={(event) => onChange(event.target.value)} value={value}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 text-slate-400" size={13} />
    </label>
  );
}

function TaskCard({ data, task, onOpen }: {
  data: AppData;
  task: Task;
  onOpen: () => void;
}) {
  const owners = taskResponsibleUsers(data, task.id);
  const teams = taskTeamList(data, task.id);
  const visibleOwners = owners.slice(0, 3);
  const remainingOwners = Math.max(owners.length - visibleOwners.length, 0);
  return (
    <button className="group block w-full rounded-xl border border-[#2b2d31] bg-[#151619] px-4 py-3 text-left shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-[#3a3c42] hover:bg-[#18191c] hover:shadow-md hover:shadow-black/25" onClick={onOpen} type="button">
      <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[#14213d] transition group-hover:text-white">{task.title}</h3>
      <div className="mt-3 flex min-w-0 items-center gap-2.5">
        {visibleOwners.length > 0 && (
          <div className="flex shrink-0 -space-x-1.5">
            {visibleOwners.map((user) => <Avatar key={user.id} size="sm" user={user} />)}
          </div>
        )}
        <p className="min-w-0 truncate text-[10px] font-medium text-zinc-400">
          {owners.length > 0
            ? `${visibleOwners.map((user) => firstName(user.name)).join(", ")}${remainingOwners > 0 ? ` +${remainingOwners}` : ""}`
            : teams.length > 0
              ? teams.map((team) => team.name).join(", ")
              : "Sem responsável"}
        </p>
        {owners.length === 0 && teams.length === 0 && (
          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="Sem responsável" />
        )}
      </div>
    </button>
  );
}

function ClientsView({ data, search, canManage, selectedClientId, onSelectClient, onBack, onOpenTask, onNewClient, onNewTask, onDeactivate, onReactivate }: {
  data: AppData;
  search: string;
  canManage: boolean;
  selectedClientId: string | null;
  onSelectClient: (id: string) => void;
  onBack: () => void;
  onOpenTask: (id: string) => void;
  onNewClient: () => void;
  onNewTask: () => void;
  onDeactivate: () => void;
  onReactivate: (client: Client) => void;
}) {
  const selected = data.clients.find((client) => client.id === selectedClientId);
  if (selected) {
    const inactive = selected.status !== "active";
    const tasks = data.tasks.filter((task) => task.client_id === selected.id);
    const active = tasks.filter((task) => !task.archived_at);
    const completed = tasks.filter((task) => task.archived_at);
    const routines = data.routines.filter((routine) => routine.client_id === selected.id && routine.active);
    return (
      <div className="app-enter">
        <button className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0069FE]" onClick={onBack} type="button">
          <ArrowLeft size={14} /> Todos os clientes
        </button>
        <section className="mb-6 overflow-hidden rounded-3xl bg-[#00113B] text-white shadow-xl shadow-blue-950/10">
          <div className="relative px-6 py-7 sm:px-8">
            <div className="absolute -right-12 -top-20 h-48 w-48 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: selected.color }} />
            <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-semibold text-white" style={{ backgroundColor: selected.color }}>
                  {initials(selected.short_name)}
                </span>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-blue-100/55">{inactive ? "Empresa fora do escopo" : "Área do cliente"}</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{selected.name}</h1>
                  <p className="mt-1 text-xs text-blue-100/60">{selected.industry || (inactive ? "Atendimento encerrado" : "Cliente ativo")}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!inactive && canManage && (
                  <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-300 bg-white/5 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15" onClick={onDeactivate} type="button">
                    <PauseCircle size={15} /> Retirar do escopo
                  </button>
                )}
                {!inactive && <PrimaryButton onClick={onNewTask}>Nova demanda</PrimaryButton>}
                {inactive && canManage && (
                  <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#00113B] transition hover:bg-blue-50" onClick={() => onReactivate(selected)} type="button">
                    <RotateCcw size={15} /> Reativar empresa
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
        {inactive && (
          <section className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={17} />
            <div>
              <p className="text-xs font-semibold">Atendimento encerrado{selected.ended_at ? ` em ${formatDate(selected.ended_at, true)}` : ""}</p>
              <p className="mt-1 text-[11px] leading-5 text-amber-800">{selected.archived_reason || "Empresa retirada da carteira ativa."} Demandas e histórico foram preservados; as rotinas permanecem pausadas.</p>
            </div>
          </section>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniStat label={inactive ? "Demandas ainda abertas" : "Demandas ativas"} value={active.length} icon={ListChecks} />
          <MiniStat label="Rotinas ativas" value={routines.length} icon={Repeat2} />
          <MiniStat label="Histórico concluído" value={completed.length} icon={Archive} />
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.7fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-[#00113B]">Demandas em andamento</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {active.length ? active.map((task) => <TaskRow data={data} key={task.id} task={task} onOpen={() => onOpenTask(task.id)} />) : <EmptyState compact icon={CheckCircle2} title="Cliente em dia" description="Nenhuma demanda ativa neste momento." />}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-[#00113B]">Equipes envolvidas</h2>
            <div className="mt-4 space-y-3">
              {data.clientTeams.filter((pair) => pair.left_id === selected.id).map((pair) => {
                const team = getTeam(data, pair.right_id);
                if (!team) return null;
                const members = data.teamMembers.filter((item) => item.left_id === team.id).map((item) => getUser(data, item.right_id)).filter(Boolean) as AppUser[];
                return (
                  <div className="rounded-xl bg-slate-50 p-3" key={team.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">{team.name}</p>
                      <div className="flex -space-x-1.5">{members.slice(0, 3).map((member) => <Avatar key={member.id} size="sm" user={member} />)}</div>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{members.length} colaboradores</p>
                  </div>
                );
              })}
            </div>
            <h2 className="mt-6 text-sm font-semibold text-[#00113B]">Próximas rotinas</h2>
            <div className="mt-3 space-y-2">
              {routines.map((routine) => (
                <div className="flex items-start gap-2 rounded-xl border border-slate-100 p-3" key={routine.id}>
                  <Repeat2 className="mt-0.5 text-[#0069FE]" size={14} />
                  <div>
                    <p className="text-[11px] font-semibold">{routine.title}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Próxima: {formatDate(routine.next_run_at, true)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const query = search.trim().toLocaleLowerCase("pt-BR");
  const filteredClients = data.clients.filter((client) => `${client.name} ${client.industry ?? ""} ${client.archived_reason ?? ""}`.toLocaleLowerCase("pt-BR").includes(query));
  const clients = filteredClients.filter((client) => client.status === "active");
  const inactiveClients = filteredClients.filter((client) => client.status !== "active");
  return (
    <div className="app-enter">
      <PageHeader
        eyebrow="Carteira ativa"
        title="Clientes"
        description="Cada empresa possui seu próprio fluxo, equipe, rotinas e histórico. Atendimentos encerrados permanecem disponíveis para consulta."
        action={canManage ? <PrimaryButton onClick={onNewClient}>Novo cliente</PrimaryButton> : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clients.map((client) => {
          const tasks = data.tasks.filter((task) => task.client_id === client.id);
          const active = tasks.filter((task) => !task.archived_at);
          const review = active.filter((task) => task.status === "review").length;
          const teamIds = data.clientTeams.filter((pair) => pair.left_id === client.id).map((pair) => pair.right_id);
          return (
            <button className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm shadow-slate-950/[0.02] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-950/[0.05]" key={client.id} onClick={() => onSelectClient(client.id)} type="button">
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl font-semibold text-white" style={{ backgroundColor: client.color }}>{initials(client.short_name)}</span>
                <ArrowUpRight className="text-slate-300 transition group-hover:text-[#0069FE]" size={18} />
              </div>
              <h2 className="mt-4 text-base font-semibold text-[#00113B]">{client.name}</h2>
              <p className="mt-1 text-xs text-slate-500">{client.industry || "Cliente ativo"}</p>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                <div><p className="text-lg font-semibold tracking-tight text-[#00113B]">{active.length}</p><p className="text-[9px] uppercase tracking-wide text-slate-400">Ativas</p></div>
                <div><p className="text-lg font-semibold tracking-tight text-amber-600">{review}</p><p className="text-[9px] uppercase tracking-wide text-slate-400">Checagem</p></div>
                <div><p className="text-lg font-semibold tracking-tight text-[#00113B]">{teamIds.length}</p><p className="text-[9px] uppercase tracking-wide text-slate-400">Equipes</p></div>
              </div>
            </button>
          );
        })}
      </div>
      {!clients.length && <EmptyState icon={Building2} title="Nenhum cliente ativo encontrado" description="Cadastre uma empresa ou ajuste sua busca para ver a carteira ativa." action={canManage ? <PrimaryButton onClick={onNewClient}>Cadastrar cliente</PrimaryButton> : undefined} />}
      {inactiveClients.length > 0 && (
        <section className="mt-9 border-t border-slate-200 pt-7">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Histórico da carteira</p>
              <h2 className="mt-1 text-lg font-semibold text-[#00113B]">Fora do escopo</h2>
              <p className="mt-1 text-xs text-slate-500">Empresas encerradas, pausadas ou removidas da vigência atual.</p>
            </div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-600">{inactiveClients.length} {inactiveClients.length === 1 ? "empresa" : "empresas"}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {inactiveClients.map((client) => (
              <button className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white" key={client.id} onClick={() => onSelectClient(client.id)} type="button">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-semibold text-white grayscale-[35%]" style={{ backgroundColor: client.color }}>{initials(client.short_name)}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#00113B]">{client.name}</p><p className="mt-0.5 text-[10px] text-slate-500">Encerrado{client.ended_at ? ` em ${formatDate(client.ended_at, true)}` : ""}</p></div>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-semibold text-amber-800">Fora do escopo</span>
                </div>
                <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-slate-500">{client.archived_reason || "Atendimento encerrado; histórico preservado."}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ListChecks }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#0069FE]"><Icon size={17} /></span>
      <div><p className="text-lg font-semibold text-[#00113B]">{value}</p><p className="text-[10px] text-slate-500">{label}</p></div>
    </div>
  );
}

function TeamView({ data, search, canManage, onNewMember, onNewTeam, onEditTeam, onRole, onRemove }: {
  data: AppData;
  search: string;
  canManage: boolean;
  onNewMember: () => void;
  onNewTeam: () => void;
  onEditTeam: (team: Team) => void;
  onRole: (id: string, role: "manager" | "collaborator") => void;
  onRemove: (member: AppUser) => void;
}) {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const users = data.users.filter((user) => user.active && `${user.name} ${user.email} ${user.job_title ?? ""}`.toLocaleLowerCase("pt-BR").includes(query));
  return (
    <div className="app-enter">
      <PageHeader
        eyebrow="Pessoas e acesso"
        title="Equipe"
        description="Libere o acesso pelo e-mail da conta ChatGPT, organize os colaboradores em equipes e remova quem não fizer mais parte da operação."
        action={canManage ? (
          <div className="flex gap-2">
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={onNewTeam} type="button"><Plus size={16} /> Nova equipe</button>
            <PrimaryButton icon={UserPlus} onClick={onNewMember}>Adicionar por e-mail</PrimaryButton>
          </div>
        ) : undefined}
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.teams.map((team) => {
          const members = (data.teamMembers.filter((pair) => pair.left_id === team.id).map((pair) => getUser(data, pair.right_id)).filter(Boolean) as AppUser[]).filter((member) => member.active);
          const clients = (data.clientTeams.filter((pair) => pair.right_id === team.id).map((pair) => getClient(data, pair.left_id)).filter(Boolean) as Client[]).filter((client) => client.status === "active");
          return (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02]" key={team.id}>
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: team.color }}><Users size={18} /></span>
                {canManage && <button aria-label={`Editar ${team.name}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-[#0069FE]" onClick={() => onEditTeam(team)} type="button"><Edit3 size={15} /></button>}
              </div>
              <h2 className="mt-4 text-sm font-semibold text-[#00113B]">{team.name}</h2>
              <p className="mt-1 min-h-8 text-[11px] leading-4 text-slate-500">{team.description}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex -space-x-2">
                  {members.slice(0, 4).map((member) => <Avatar key={member.id} size="sm" user={member} />)}
                  {members.length > 4 && <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[9px] font-semibold text-slate-500">+{members.length - 4}</span>}
                </div>
                <span className="text-[10px] text-slate-500">{clients.length} clientes</span>
              </div>
              {clients.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{clients.slice(0, 4).map((client) => <span className="rounded-md bg-slate-50 px-2 py-1 text-[9px] font-medium text-slate-500" key={client.id}>{client.short_name}</span>)}</div>}
            </article>
          );
        })}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.02]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div><h2 className="text-sm font-semibold text-[#00113B]">Colaboradores</h2><p className="mt-0.5 text-[11px] text-slate-500">{users.length} pessoas ativas</p></div>
          <BriefcaseBusiness className="text-slate-300" size={18} />
        </div>
        <div className="divide-y divide-slate-100">
          {users.map((user) => {
            const teams = data.teamMembers.filter((pair) => pair.right_id === user.id).map((pair) => getTeam(data, pair.left_id)).filter(Boolean) as Team[];
            const assigned = data.taskAssignees.filter((pair) => pair.right_id === user.id).map((pair) => pair.left_id);
            const active = data.tasks.filter((task) => assigned.includes(task.id) && !task.archived_at).length;
            return (
              <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center" key={user.id}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar user={user} />
                  <div className="min-w-0"><p className="truncate text-xs font-semibold text-[#14213d]">{user.name}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{user.job_title} · {user.email}</p></div>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:w-64">
                  {teams.map((team) => <span className="rounded-lg bg-slate-50 px-2 py-1 text-[9px] font-medium text-slate-500" key={team.id}>{team.name}</span>)}
                  {!teams.length && <span className="text-[10px] text-slate-400">Sem equipe</span>}
                </div>
                <span className="w-20 text-[10px] font-medium text-slate-500">{active} ativas</span>
                <div className="flex items-center gap-2 sm:w-44">
                  {data.currentUser.role === "owner" && user.role !== "owner" ? (
                    <select className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-600" onChange={(event) => onRole(user.id, event.target.value as "manager" | "collaborator")} value={user.role}>
                      <option value="collaborator">Colaborador</option>
                      <option value="manager">Gestor</option>
                    </select>
                  ) : <span className="inline-flex flex-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-semibold text-[#0069FE]">{roleLabel(user.role)}</span>}
                  {canManage && user.role !== "owner" && (data.currentUser.role === "owner" || user.role === "collaborator") && (
                    <button aria-label={`Excluir ${user.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 transition hover:bg-rose-500/20" onClick={() => onRemove(user)} title="Excluir funcionário" type="button"><UserMinus size={14} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RoutinesView({ data, search, canManage, onNew, onToggle }: {
  data: AppData;
  search: string;
  canManage: boolean;
  onNew: () => void;
  onToggle: (routine: Routine) => void;
}) {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const routines = data.routines.filter((routine) => `${routine.title} ${getClient(data, routine.client_id)?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(query));
  return (
    <div className="app-enter">
      <PageHeader
        eyebrow="Automação operacional"
        title="Rotinas recorrentes"
        description="Configure uma vez. A central cria uma nova ocorrência a cada ciclo, mantendo o histórico de cada entrega."
        action={canManage ? <PrimaryButton onClick={onNew}>Nova rotina</PrimaryButton> : undefined}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Rotinas ativas" value={routines.filter((routine) => routine.active).length} icon={PlayCircle} />
        <MiniStat label="Pausadas" value={routines.filter((routine) => !routine.active).length} icon={PauseCircle} />
        <MiniStat label="Ocorrências geradas" value={data.tasks.filter((task) => task.routine_id).length} icon={Repeat2} />
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        {routines.map((routine) => {
          const client = getClient(data, routine.client_id);
          const clientInactive = client?.status !== "active";
          const users = data.routineAssignees.filter((pair) => pair.left_id === routine.id).map((pair) => getUser(data, pair.right_id)).filter(Boolean) as AppUser[];
          const teams = data.routineTeams.filter((pair) => pair.left_id === routine.id).map((pair) => getTeam(data, pair.right_id)).filter(Boolean) as Team[];
          return (
            <article className={`rounded-2xl border bg-white p-5 shadow-sm shadow-slate-950/[0.02] ${routine.active ? "border-slate-200" : "border-slate-200 opacity-65"}`} key={routine.id}>
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${routine.active ? "bg-blue-50 text-[#0069FE]" : "bg-slate-100 text-slate-400"}`}><Repeat2 size={19} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{client?.name}</p><h2 className="mt-1 text-sm font-semibold text-[#00113B]">{routine.title}</h2></div>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${clientInactive ? "bg-amber-100 text-amber-800" : routine.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{clientInactive ? "Cliente fora do escopo" : routine.active ? "Ativa" : "Pausada"}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">{routine.description}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                <div><p className="text-[9px] uppercase tracking-wide text-slate-400">Frequência</p><p className="mt-1 text-[11px] font-semibold text-slate-700">{frequencyLabel(routine)}</p></div>
                <div><p className="text-[9px] uppercase tracking-wide text-slate-400">Próxima ocorrência</p><p className="mt-1 text-[11px] font-semibold text-slate-700">{formatDate(routine.next_run_at, true)}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">{users.map((user) => <Avatar key={user.id} size="sm" user={user} />)}</div>
                  {teams.map((team) => <span className="rounded-lg bg-blue-50 px-2 py-1 text-[9px] font-semibold text-[#0069FE]" key={team.id}>{team.name}</span>)}
                </div>
                {canManage && <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45" disabled={clientInactive} onClick={() => onToggle(routine)} title={clientInactive ? "Reative o cliente antes de alterar esta rotina" : undefined} type="button">{routine.active ? <PauseCircle size={13} /> : <PlayCircle size={13} />}{clientInactive ? "Cliente inativo" : routine.active ? "Pausar" : "Reativar"}</button>}
              </div>
            </article>
          );
        })}
      </section>
      {!routines.length && <EmptyState icon={Repeat2} title="Nenhuma rotina encontrada" description="Crie uma rotina para automatizar tarefas diárias, semanais ou mensais." action={canManage ? <PrimaryButton onClick={onNew}>Criar rotina</PrimaryButton> : undefined} />}
    </div>
  );
}

function ArchiveView({ data, search, onOpenTask, onReopen }: {
  data: AppData;
  search: string;
  onOpenTask: (id: string) => void;
  onReopen: (task: Task) => void;
}) {
  const [clientFilter, setClientFilter] = useState("all");
  const tasks = filterTasks(data, data.tasks.filter((task) => Boolean(task.archived_at)), search).filter((task) => clientFilter === "all" || task.client_id === clientFilter);
  return (
    <div className="app-enter">
      <PageHeader eyebrow="Histórico persistente" title="Arquivo" description="Demandas concluídas permanecem pesquisáveis, com responsáveis, comentários, arquivos e alterações preservados." />
      <div className="mb-4 flex items-center justify-between gap-3">
        <FilterSelect icon={Building2} value={clientFilter} onChange={setClientFilter}>
          <option value="all">Todos os clientes</option>
          {data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </FilterSelect>
        <span className="text-xs text-slate-500">{tasks.length} registros</span>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.02]">
        <div className="app-scrollbar overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <tr><th className="px-5 py-3">Demanda</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Responsáveis</th><th className="px-4 py-3">Concluída</th><th className="px-4 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const client = getClient(data, task.client_id);
                const users = taskUsers(data, task.id);
                return (
                  <tr className="group hover:bg-slate-50/70" key={task.id}>
                    <td className="px-5 py-4"><button className="text-xs font-semibold text-[#14213d] group-hover:text-[#0069FE]" onClick={() => onOpenTask(task.id)} type="button">{task.title}</button><p className="mt-1 text-[10px] text-slate-400">Criada em {formatDate(task.created_at.slice(0, 10), true)}</p></td>
                    <td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: client?.color }} />{client?.name}</span></td>
                    <td className="px-4 py-4"><div className="flex -space-x-1.5">{users.map((user) => <Avatar key={user.id} size="sm" user={user} />)}</div></td>
                    <td className="px-4 py-4 text-[11px] text-slate-500">{formatDate(task.completed_at?.slice(0, 10), true)}</td>
                    <td className="px-4 py-4 text-right"><button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 hover:border-[#0069FE] hover:text-[#0069FE]" onClick={() => onReopen(task)} type="button"><RotateCcw size={12} /> Reabrir</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!tasks.length && <EmptyState compact icon={Archive} title="Arquivo vazio" description="As demandas concluídas aparecerão aqui automaticamente." />}
      </section>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action, compact = false }: {
  icon: typeof Inbox;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`text-center ${compact ? "px-5 py-10" : "mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14"}`}>
      <Icon className="mx-auto text-slate-300" size={compact ? 24 : 30} />
      <h3 className="mt-3 text-sm font-semibold text-[#00113B]">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function TaskDrawer({ data, task, working, onClose, onRefresh, onToast, onEdit, onAction }: {
  data: AppData;
  task: Task;
  working: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onToast: (message: string) => void;
  onEdit: () => void;
  onAction: (payload: ActionPayload, successMessage?: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<"details" | "discussion" | "history">("details");
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const client = getClient(data, task.client_id);
  const assignees = taskUsers(data, task.id);
  const teams = taskTeamList(data, task.id);
  const creator = getUser(data, task.created_by);
  const comments = data.comments.filter((item) => item.task_id === task.id);
  const events = data.events.filter((item) => item.task_id === task.id);
  const attachments = data.attachments.filter((item) => item.task_id === task.id);
  const overdue = !task.archived_at && task.due_at < dateKey();
  const canManage = data.currentUser.role !== "collaborator";

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    const ok = await onAction({ action: "add_comment", taskId: task.id, body: comment }, "Comentário adicionado.");
    if (ok) setComment("");
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("taskId", task.id);
      form.append("file", file);
      const response = await fetch("/api/attachments", { method: "POST", body: form });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Falha no envio.");
      await onRefresh();
      onToast("Arquivo anexado à demanda.");
    } catch (cause) {
      onToast(cause instanceof Error ? cause.message : "Falha no envio.");
    } finally {
      setUploading(false);
    }
  };

  const statusAction = async (status: TaskStatus, message: string) => {
    await onAction({ action: "update_status", id: task.id, status }, message);
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button aria-label="Fechar demanda" className="absolute inset-0 bg-[#00113B]/40 backdrop-blur-[2px]" onClick={onClose} type="button" />
      <aside className="app-enter app-scrollbar relative z-10 flex h-full w-full max-w-[620px] flex-col overflow-y-auto bg-[#0d0e10] shadow-2xl shadow-black/50">
        <header className="sticky top-0 z-10 border-b border-[#292b30] bg-[#111214] px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: client?.color }} />
              {client?.name}
              {task.routine_id && <span className="ml-1 inline-flex items-center gap-1 rounded-lg border border-[#2b2d31] bg-[#1a1b1e] px-2 py-1 text-[9px] text-zinc-300"><Repeat2 size={10} /> Recorrente</span>}
            </div>
            <div className="flex items-center gap-1">
              {canManage && <button aria-label="Editar demanda" className="rounded-lg p-2 text-zinc-500 transition hover:bg-[#202124] hover:text-white" onClick={onEdit} type="button"><Edit3 size={17} /></button>}
              <button aria-label="Fechar" className="rounded-lg p-2 text-zinc-500 transition hover:bg-[#202124] hover:text-white" onClick={onClose} type="button"><X size={19} /></button>
            </div>
          </div>
          <h1 className="mt-3 pr-8 text-xl font-semibold leading-7 tracking-[-0.025em] text-[#00113B]">{task.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold ${statusMeta[task.status].className}`}><span className={`h-1.5 w-1.5 rounded-full ${statusMeta[task.status].dot}`} />{statusMeta[task.status].label}</span>
            <span className={`text-[10px] font-semibold ${priorityMeta[task.priority].className}`}>Prioridade {priorityMeta[task.priority].label.toLowerCase()}</span>
          </div>
          <div className="mt-4 flex gap-1 border-b border-[#292b30]">
            {(["details", "discussion", "history"] as const).map((item) => {
              const labels = { details: "Detalhes", discussion: `Mensagens e anexos (${comments.length + attachments.length})`, history: "Histórico" };
              return <button className={`-mb-px border-b-2 px-3 py-2 text-[10px] font-semibold transition ${tab === item ? "border-zinc-200 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`} key={item} onClick={() => setTab(item)} type="button">{labels[item]}</button>;
            })}
          </div>
        </header>

        <div className="flex-1 px-5 py-5 sm:px-6">
          {tab === "details" && (
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Descrição</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{task.description || "Nenhuma descrição adicionada."}</p>
              </section>
              <section className="grid gap-3 sm:grid-cols-2">
                <InfoCard icon={CalendarDays} label="Prazo" value={formatDate(task.due_at)} danger={overdue} />
                <InfoCard icon={Clock3} label="Criada em" value={formatDate(task.created_at.slice(0, 10))} />
                <InfoCard icon={UserRound} label="Criada por" value={creator?.name || "Equipe"} />
                <InfoCard icon={Users} label="Tipo" value={task.assignment_type === "collective" ? "Demanda coletiva" : "Demanda individual"} />
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Responsáveis</h2>
                <div className="mt-4 space-y-3">
                  {assignees.map((user) => <div className="flex items-center gap-3" key={user.id}><Avatar size="sm" user={user} /><div><p className="text-xs font-semibold text-[#14213d]">{user.name}</p><p className="text-[10px] text-slate-500">{user.job_title}</p></div></div>)}
                  {teams.map((team) => <div className="flex items-center gap-3" key={team.id}><span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ backgroundColor: team.color }}><Users size={12} /></span><div><p className="text-xs font-semibold text-[#14213d]">{team.name}</p><p className="text-[10px] text-slate-500">Todos os membros envolvidos</p></div></div>)}
                </div>
              </section>
              {task.archived_at && (
                <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-emerald-600" size={18} /><div><p className="text-xs font-semibold text-emerald-800">Demanda concluída e arquivada</p><p className="mt-1 text-[10px] leading-5 text-emerald-700">O conteúdo continua disponível para consulta e pode ser reaberto por um gestor.</p></div></div>
                </section>
              )}
            </div>
          )}

          {tab === "discussion" && (
            <div className="space-y-5">
              <section className="rounded-2xl border border-[#292b30] bg-[#141518] p-5">
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2b2d31] bg-[#1c1d21] text-zinc-300"><Paperclip size={14} /></span><div><h2 className="text-xs font-semibold text-white">Anexos</h2><p className="mt-0.5 text-[9px] text-zinc-500">Materiais vinculados à demanda</p></div></div><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#34363c] bg-[#18191c] px-2.5 py-1.5 text-[10px] font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-[#202124] hover:text-white"><input className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} type="file" />{uploading ? <LoaderCircle className="animate-spin" size={12} /> : <Plus size={12} />} Anexar</label></div>
                <div className="mt-4 space-y-2">
                  {attachments.map((file) => <a className="flex items-center gap-3 rounded-xl border border-[#24262a] bg-[#101114] p-3 transition hover:border-[#3a3c42] hover:bg-[#1b1c1f]" href={`/api/attachments?id=${encodeURIComponent(file.id)}`} key={file.id}><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2b2d31] bg-[#1c1d21] text-zinc-300"><FileText size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-zinc-200">{file.file_name}</span><span className="mt-0.5 block text-[9px] text-zinc-500">{formatBytes(file.size)} · {formatDateTime(file.created_at)}</span></span><ArrowUpRight size={13} className="text-zinc-600" /></a>)}
                  {!attachments.length && <p className="rounded-xl border border-dashed border-[#303238] bg-[#101114] px-4 py-5 text-center text-[10px] text-zinc-500">Nenhum arquivo anexado.</p>}
                </div>
              </section>
              <section className="rounded-2xl border border-[#292b30] bg-[#141518] p-5">
                <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2b2d31] bg-[#1c1d21] text-zinc-300"><MessageSquare size={14} /></span><div><h2 className="text-xs font-semibold text-white">Mensagens da demanda</h2><p className="mt-0.5 text-[9px] text-zinc-500">Ajustes e atualizações ficam registrados aqui</p></div></div>
                <div className="mt-4 space-y-4">
                  {comments.map((item) => { const author = getUser(data, item.user_id); return <div className="flex gap-3" key={item.id}>{author && <Avatar size="sm" user={author} />}<div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-[#24262a] bg-[#101114] px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold text-zinc-200">{author?.name || "Colaborador"}</p><p className="text-[9px] text-zinc-600">{formatDateTime(item.created_at)}</p></div><p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-5 text-zinc-300">{item.body}</p></div></div>; })}
                  {!comments.length && <p className="rounded-xl border border-dashed border-[#303238] bg-[#101114] px-4 py-6 text-center text-[10px] text-zinc-500">Inicie a conversa e mantenha os ajustes registrados aqui.</p>}
                </div>
                <form className="mt-5 flex items-end gap-2 border-t border-[#292b30] pt-4" onSubmit={submitComment}>
                  <textarea className="min-h-20 flex-1 resize-none rounded-xl border border-[#34363c] bg-[#0f1012] px-3 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:bg-[#121316] focus:outline-none" onChange={(event) => setComment(event.target.value)} placeholder="Escreva uma atualização ou ajuste…" value={comment} />
                  <button aria-label="Enviar comentário" className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950 transition hover:bg-white disabled:opacity-30" disabled={!comment.trim() || working} type="submit"><Send size={15} /></button>
                </form>
              </section>
            </div>
          )}

          {tab === "history" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-xs font-semibold text-[#00113B]">Linha do tempo</h2>
              <div className="mt-5 space-y-0">
                {events.map((event, index) => { const author = getUser(data, event.actor_id); return <div className="relative flex gap-3 pb-6" key={event.id}>{index < events.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-[#2b2d31]" />}<span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#2b2d31] bg-[#1a1b1e] text-zinc-300"><HistoryIcon type={event.event_type} /></span><div className="pt-0.5"><p className="text-[11px] leading-5 text-slate-600"><strong className="font-semibold text-[#14213d]">{author?.name || "Sistema"}</strong> {eventText(event.event_type, event.from_value, event.to_value)}</p><p className="mt-1 text-[9px] text-slate-400">{formatDateTime(event.created_at)}</p></div></div>; })}
                {!events.length && <p className="py-8 text-center text-[10px] text-slate-400">Nenhum evento registrado.</p>}
              </div>
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 border-t border-[#292b30] bg-[#111214] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {task.status === "pending" && <PrimaryButton icon={PlayCircle} onClick={() => void statusAction("in_progress", "Demanda iniciada.")}>Iniciar demanda</PrimaryButton>}
            {task.status === "in_progress" && <PrimaryButton icon={Eye} onClick={() => void statusAction("review", "Demanda enviada para checagem.")}>Enviar para checagem</PrimaryButton>}
            {task.status === "review" && <><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={() => void statusAction("in_progress", "Demanda devolvida para ajustes.")} type="button"><RotateCcw size={15} /> Solicitar ajustes</button><PrimaryButton icon={CheckCircle2} onClick={() => void statusAction("completed", "Demanda concluída e arquivada.")}>Concluir</PrimaryButton></>}
            {task.status === "completed" && canManage && <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:border-[#0069FE] hover:text-[#0069FE]" onClick={() => void statusAction("in_progress", "Demanda reaberta.")} type="button"><RotateCcw size={15} /> Reabrir demanda</button>}
          </div>
        </footer>
      </aside>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, danger = false }: { icon: typeof CalendarDays; label: string; value: string; danger?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-[10px] font-medium text-slate-400"><Icon size={14} />{label}</div><p className={`mt-2 text-xs font-semibold ${danger ? "text-rose-600" : "text-[#14213d]"}`}>{value}</p></div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function HistoryIcon({ type }: { type: string }) {
  if (type === "status_changed") return <ArrowUpRight size={12} />;
  if (type === "comment_added") return <MessageSquare size={12} />;
  if (type === "routine_generated") return <Repeat2 size={12} />;
  return <CircleDashed size={12} />;
}

function eventText(type: string, from: string | null, to: string | null) {
  if (type === "created") return "criou a demanda.";
  if (type === "status_changed") return `alterou o status de ${from ? statusMeta[from as TaskStatus]?.label ?? from : "—"} para ${to ? statusMeta[to as TaskStatus]?.label ?? to : "—"}.`;
  if (type === "comment_added") return "adicionou um comentário.";
  if (type === "details_updated") return "atualizou os detalhes e o prazo da demanda.";
  if (type === "routine_generated") return "gerou esta ocorrência automaticamente a partir de uma rotina.";
  return "registrou uma atualização.";
}

function Modal({ title, description, onClose, children, footer }: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:px-5 sm:py-8">
      <button aria-label="Fechar janela" className="absolute inset-0 bg-[#00113B]/45 backdrop-blur-sm" onClick={onClose} type="button" />
      <section className="app-enter relative z-10 flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
          <div><h2 className="text-lg font-semibold tracking-[-0.025em] text-[#00113B]">{title}</h2>{description && <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>}</div>
          <button aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X size={18} /></button>
        </header>
        <div className="app-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
          {footer}
        </footer>
      </section>
    </div>
  );
}

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-[#14213d] placeholder:text-slate-400 focus:border-[#0069FE] focus:bg-white focus:outline-none";
const textareaClass = "min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-[#14213d] placeholder:text-slate-400 focus:border-[#0069FE] focus:bg-white focus:outline-none";

function Field({ label, required = false, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}{required && <span className="text-[#0069FE]">*</span>}</span>{children}{hint && <span className="mt-1 block text-[9px] text-slate-400">{hint}</span>}</label>;
}

function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="border-t border-slate-100 pt-5 first:border-0 first:pt-0"><h3 className="text-xs font-semibold text-[#00113B]">{title}</h3>{description && <p className="mt-1 text-[10px] leading-5 text-slate-500">{description}</p>}<div className="mt-4">{children}</div></section>;
}

function ToggleCard({ selected, onClick, icon: Icon, title, description }: { selected: boolean; onClick: () => void; icon: typeof UserRound; title: string; description: string }) {
  return <button className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-[#0069FE] bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`} onClick={onClick} type="button"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#0069FE] text-white" : "bg-slate-100 text-slate-500"}`}><Icon size={15} /></span><span><span className={`block text-[11px] font-semibold ${selected ? "text-[#0069FE]" : "text-[#14213d]"}`}>{title}</span><span className="mt-1 block text-[9px] leading-4 text-slate-500">{description}</span></span></button>;
}

function CheckGrid({ items, selected, onChange, type }: { items: Array<AppUser | Team | Client>; selected: string[]; onChange: (ids: string[]) => void; type: "user" | "team" | "client" }) {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  return <div className="grid gap-2 sm:grid-cols-2">{items.map((item) => {
    const checked = selected.includes(item.id);
    const title = "name" in item ? item.name : "";
    const subtitle = type === "user" ? (item as AppUser).job_title : type === "client" ? ((item as Client).status === "active" ? (item as Client).industry : "Fora do escopo") : (item as Team).description;
    const color = type === "user" ? (item as AppUser).avatar_color : (item as Team | Client).color;
    return <button className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${checked ? "border-[#0069FE] bg-blue-50/70" : "border-slate-200 hover:bg-slate-50"}`} key={item.id} onClick={() => toggle(item.id)} type="button"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white" style={{ backgroundColor: color }}>{initials(title)}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-[#14213d]">{title}</span><span className="mt-0.5 block truncate text-[9px] text-slate-400">{subtitle || "—"}</span></span><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? "border-[#0069FE] bg-[#0069FE] text-white" : "border-slate-300 text-transparent"}`}><Check size={12} /></span></button>;
  })}</div>;
}

function ModalFooter({ onClose, submitLabel, working, danger = false }: { onClose: () => void; submitLabel: string; working: boolean; danger?: boolean }) {
  return <><button className="h-10 rounded-xl px-4 text-xs font-semibold text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Cancelar</button>{danger ? <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50" disabled={working} type="submit">{working ? <LoaderCircle className="animate-spin" size={16} /> : <UserMinus size={16} />}{submitLabel}</button> : <PrimaryButton disabled={working} icon={working ? LoaderCircle : Check} type="submit">{submitLabel}</PrimaryButton>}</>;
}

function TaskModal({ data, task, working, initialClientId, onClose, onSubmit }: {
  data: AppData;
  task: Task | null;
  working: boolean;
  initialClientId: string | null;
  onClose: () => void;
  onSubmit: (payload: ActionPayload) => Promise<void>;
}) {
  const activeClients = data.clients.filter((client) => client.status === "active");
  const selectableClients = task
    ? data.clients.filter((client) => client.status === "active" || client.id === task.client_id)
    : activeClients;
  const requestedClient = activeClients.some((client) => client.id === initialClientId) ? initialClientId : null;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [clientId, setClientId] = useState(task?.client_id ?? requestedClient ?? activeClients[0]?.id ?? "");
  const [dueAt, setDueAt] = useState(task?.due_at ?? addDate(3));
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "normal");
  const [assignmentType, setAssignmentType] = useState<"individual" | "collective">(task?.assignment_type ?? "individual");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task ? data.taskAssignees.filter((pair) => pair.left_id === task.id).map((pair) => pair.right_id) : []);
  const [teamIds, setTeamIds] = useState<string[]>(task ? data.taskTeams.filter((pair) => pair.left_id === task.id).map((pair) => pair.right_id) : []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit({ action: task ? "update_task" : "create_task", id: task?.id, title, description, clientId, dueAt, priority, assignmentType, assigneeIds, teamIds });
  };
  return (
    <form onSubmit={submit}>
      <Modal title={task ? "Editar demanda" : "Nova demanda"} description="Centralize o briefing, os responsáveis e o prazo desde o início." onClose={onClose} footer={<ModalFooter onClose={onClose} submitLabel={task ? "Salvar alterações" : "Criar demanda"} working={working} />}>
        <div className="space-y-6">
          <FormSection title="Informações da demanda">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Título" required><input className={inputClass} maxLength={180} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Criar campanha de lançamento" required value={title} /></Field></div>
              <div className="sm:col-span-2"><Field label="Descrição"><textarea className={textareaClass} onChange={(event) => setDescription(event.target.value)} placeholder="Contexto, objetivo, referências e critérios de entrega…" value={description} /></Field></div>
              <Field label="Cliente" required><select className={inputClass} disabled={Boolean(task)} onChange={(event) => setClientId(event.target.value)} required value={clientId}>{selectableClients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.status !== "active" ? " · fora do escopo" : ""}</option>)}</select></Field>
              <Field label="Prazo" required><input className={inputClass} min={dateKey()} onChange={(event) => setDueAt(event.target.value)} required type="date" value={dueAt} /></Field>
              <Field label="Prioridade"><select className={inputClass} onChange={(event) => setPriority(event.target.value as Priority)} value={priority}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></Field>
            </div>
          </FormSection>
          <FormSection title="Tipo de atribuição" description="Demandas coletivas ficam visíveis para todos os membros das equipes selecionadas.">
            <div className="grid gap-2 sm:grid-cols-2"><ToggleCard description="Direcionada a pessoas específicas." icon={UserRound} onClick={() => setAssignmentType("individual")} selected={assignmentType === "individual"} title="Individual" /><ToggleCard description="Compartilhada com todos os envolvidos." icon={Users} onClick={() => setAssignmentType("collective")} selected={assignmentType === "collective"} title="Coletiva" /></div>
          </FormSection>
          <FormSection title="Responsáveis diretos" description="Você pode selecionar uma ou mais pessoas."><CheckGrid items={data.users.filter((user) => user.active)} onChange={setAssigneeIds} selected={assigneeIds} type="user" /></FormSection>
          <FormSection title="Equipes envolvidas" description="Todos os membros das equipes terão visibilidade compartilhada."><CheckGrid items={data.teams} onChange={setTeamIds} selected={teamIds} type="team" /></FormSection>
        </div>
      </Modal>
    </form>
  );
}

function ClientModal({ working, onClose, onSubmit }: { working: boolean; onClose: () => void; onSubmit: (payload: ActionPayload) => Promise<void> }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [industry, setIndustry] = useState("");
  const [color, setColor] = useState("#0069FE");
  return <form onSubmit={(event) => { event.preventDefault(); void onSubmit({ action: "create_client", name, shortName, industry, color }); }}><Modal title="Novo cliente" description="Uma área completa será criada para demandas, equipes, rotinas e histórico." onClose={onClose} footer={<ModalFooter onClose={onClose} submitLabel="Cadastrar cliente" working={working} />}><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Nome da empresa" required><input className={inputClass} onChange={(event) => setName(event.target.value)} placeholder="Nome completo do cliente" required value={name} /></Field></div><Field label="Nome curto"><input className={inputClass} onChange={(event) => setShortName(event.target.value)} placeholder="Como aparece nos cards" value={shortName} /></Field><Field label="Segmento"><input className={inputClass} onChange={(event) => setIndustry(event.target.value)} placeholder="Ex.: Gastronomia" value={industry} /></Field><div className="sm:col-span-2"><Field label="Cor de identificação"><div className="flex items-center gap-3"><input aria-label="Cor do cliente" className="h-10 w-14 rounded-xl border border-slate-200 bg-white p-1" onChange={(event) => setColor(event.target.value)} type="color" value={color} /><input className={inputClass} onChange={(event) => setColor(event.target.value)} value={color} /></div></Field></div></div></Modal></form>;
}

function DeactivateClientModal({ client, working, onClose, onSubmit }: { client: Client; working: boolean; onClose: () => void; onSubmit: (payload: ActionPayload) => Promise<void> }) {
  const [reason, setReason] = useState("Fim de contrato ou vigência");
  const [endedAt, setEndedAt] = useState(dateKey());
  const [details, setDetails] = useState("");
  return (
    <form onSubmit={(event) => { event.preventDefault(); void onSubmit({ action: "deactivate_client", id: client.id, reason, endedAt, details }); }}>
      <Modal title="Retirar empresa do escopo" description={`O atendimento de ${client.name} será encerrado sem apagar o histórico.`} onClose={onClose} footer={<ModalFooter onClose={onClose} submitLabel="Retirar do escopo" working={working} />}>
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
            <div><p className="text-xs font-semibold">Nenhum dado será apagado</p><p className="mt-1 text-[10px] leading-5 text-amber-800">A empresa sairá da carteira ativa, as rotinas serão pausadas e as demandas ainda abertas continuarão no fluxo até serem finalizadas.</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Motivo" required><select className={inputClass} onChange={(event) => setReason(event.target.value)} required value={reason}><option>Fim de contrato ou vigência</option><option>Fora do escopo atual</option><option>Pausa solicitada pelo cliente</option><option>Inadimplência</option><option>Outro motivo</option></select></Field></div>
            <Field label="Data de encerramento" required><input className={inputClass} max={dateKey()} onChange={(event) => setEndedAt(event.target.value)} required type="date" value={endedAt} /></Field>
            <div className="sm:col-span-2"><Field label="Observação" hint="Opcional"><textarea className={textareaClass} maxLength={360} onChange={(event) => setDetails(event.target.value)} placeholder="Ex.: contrato não renovado para o próximo ciclo…" value={details} /></Field></div>
          </div>
        </div>
      </Modal>
    </form>
  );
}

function MemberModal({ data, working, onClose, onSubmit }: { data: AppData; working: boolean; onClose: () => void; onSubmit: (payload: ActionPayload) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<"manager" | "collaborator">("collaborator");
  const [color, setColor] = useState("#7C3AED");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  return (
    <form onSubmit={(event) => { event.preventDefault(); void onSubmit({ action: "create_member", name, email, jobTitle, role, color, teamIds }); }}>
      <Modal
        title="Adicionar colaborador por e-mail"
        description="Use exatamente o e-mail da conta ChatGPT da pessoa. Depois do cadastro, ela poderá entrar pelo link do sistema."
        onClose={onClose}
        footer={<ModalFooter onClose={onClose} submitLabel="Liberar acesso" working={working} />}
      >
        <div className="space-y-6">
          <FormSection title="Dados de acesso">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="E-mail de acesso" required><input autoComplete="email" className={inputClass} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.com" required type="email" value={email} /></Field></div>
              <Field label="Nome completo" hint="Opcional"><input autoComplete="name" className={inputClass} onChange={(event) => setName(event.target.value)} placeholder="Preenchido pelo e-mail se ficar vazio" value={name} /></Field>
              <Field label="Função"><input className={inputClass} onChange={(event) => setJobTitle(event.target.value)} placeholder="Ex.: Designer" value={jobTitle} /></Field>
              <Field label="Perfil de acesso"><select className={inputClass} onChange={(event) => setRole(event.target.value as "manager" | "collaborator")} value={role}><option value="collaborator">Colaborador</option><option value="manager">Gestor</option></select></Field>
              <Field label="Cor do avatar"><input className="h-10 w-16 rounded-xl border border-slate-200 bg-white p-1" onChange={(event) => setColor(event.target.value)} type="color" value={color} /></Field>
            </div>
          </FormSection>
          <FormSection title="Equipes" description="A mesma pessoa pode participar de várias equipes."><CheckGrid items={data.teams} onChange={setTeamIds} selected={teamIds} type="team" /></FormSection>
        </div>
      </Modal>
    </form>
  );
}

function RemoveMemberModal({ member, working, onClose, onSubmit }: { member: AppUser; working: boolean; onClose: () => void; onSubmit: (payload: ActionPayload) => Promise<void> }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); void onSubmit({ action: "deactivate_member", id: member.id }); }}>
      <Modal
        title="Excluir funcionário"
        description={`O acesso de ${member.name} será removido imediatamente.`}
        onClose={onClose}
        footer={<ModalFooter danger onClose={onClose} submitLabel="Excluir funcionário" working={working} />}
      >
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400"><UserMinus size={18} /></span>
            <div>
              <p className="text-sm font-semibold text-rose-300">O login será bloqueado</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">A pessoa sairá das equipes, rotinas e demandas ainda abertas. Comentários, entregas concluídas e todo o histórico continuarão registrados.</p>
            </div>
          </div>
        </div>
      </Modal>
    </form>
  );
}

function TeamModal({ data, team, working, onClose, onSubmit }: { data: AppData; team: Team | null; working: boolean; onClose: () => void; onSubmit: (payload: ActionPayload) => Promise<void> }) {
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [color, setColor] = useState(team?.color ?? "#0069FE");
  const [memberIds, setMemberIds] = useState<string[]>(team ? data.teamMembers.filter((pair) => pair.left_id === team.id).map((pair) => pair.right_id) : []);
  const [clientIds, setClientIds] = useState<string[]>(team ? data.clientTeams.filter((pair) => pair.right_id === team.id).map((pair) => pair.left_id) : []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const linkedTasks = team ? data.taskTeams.filter((pair) => pair.right_id === team.id).length : 0;
  const linkedRoutines = team ? data.routineTeams.filter((pair) => pair.right_id === team.id).length : 0;
  const footer = confirmDelete ? (
    <>
      <button className="h-10 rounded-xl px-4 text-xs font-semibold text-slate-500 hover:bg-slate-100" onClick={() => setConfirmDelete(false)} type="button">Voltar</button>
      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50" disabled={working} onClick={() => void onSubmit({ action: "delete_team", id: team?.id })} type="button">{working ? <LoaderCircle className="animate-spin" size={16} /> : <Trash2 size={16} />}Confirmar exclusão</button>
    </>
  ) : (
    <div className="flex w-full items-center justify-between gap-3">
      {team ? <button className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-rose-400 hover:bg-rose-500/10" onClick={() => setConfirmDelete(true)} type="button"><Trash2 size={15} /> Excluir equipe</button> : <span />}
      <ModalFooter onClose={onClose} submitLabel={team ? "Salvar equipe" : "Criar equipe"} working={working} />
    </div>
  );
  return <form onSubmit={(event) => { event.preventDefault(); void onSubmit({ action: team ? "update_team" : "create_team", id: team?.id, name, description, color, memberIds, clientIds }); }}><Modal title={confirmDelete ? `Excluir ${team?.name}?` : team ? "Editar equipe" : "Nova equipe"} description={confirmDelete ? "Esta ação remove somente a equipe e suas vinculações." : "Altere os dados, membros e clientes vinculados à equipe."} onClose={onClose} footer={footer}>{confirmDelete ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400"><Trash2 size={18} /></span><div><p className="text-sm font-semibold text-rose-300">A equipe será excluída</p><p className="mt-1 text-[11px] leading-5 text-slate-400">{memberIds.length} membro(s), {linkedTasks} demanda(s) e {linkedRoutines} rotina(s) serão desvinculados. Os colaboradores, as demandas e seus históricos não serão apagados.</p></div></div></div> : <div className="space-y-6"><FormSection title="Identificação"><div className="grid gap-4 sm:grid-cols-[1fr_80px]"><Field label="Nome da equipe" required><input className={inputClass} onChange={(event) => setName(event.target.value)} required value={name} /></Field><Field label="Cor"><input className="h-10 w-full rounded-xl border border-slate-200 bg-white p-1" onChange={(event) => setColor(event.target.value)} type="color" value={color} /></Field><div className="sm:col-span-2"><Field label="Descrição"><textarea className={textareaClass} onChange={(event) => setDescription(event.target.value)} value={description} /></Field></div></div></FormSection><FormSection title="Membros"><CheckGrid items={data.users.filter((user) => user.active)} onChange={setMemberIds} selected={memberIds} type="user" /></FormSection><FormSection title="Clientes atendidos"><CheckGrid items={data.clients} onChange={setClientIds} selected={clientIds} type="client" /></FormSection></div>}</Modal></form>;
}

function RoutineModal({ data, working, initialClientId, onClose, onSubmit }: { data: AppData; working: boolean; initialClientId: string | null; onClose: () => void; onSubmit: (payload: ActionPayload) => Promise<void> }) {
  const activeClients = data.clients.filter((client) => client.status === "active");
  const requestedClient = activeClients.some((client) => client.id === initialClientId) ? initialClientId : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState(requestedClient ?? activeClients[0]?.id ?? "");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [weekdays, setWeekdays] = useState<string[]>(["1"]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [dueOffsetDays, setDueOffsetDays] = useState(1);
  const [nextRunAt, setNextRunAt] = useState(addDate(1));
  const [endsAt, setEndsAt] = useState("");
  const [assignmentType, setAssignmentType] = useState<"individual" | "collective">("collective");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const dayOptions = [{ id: "1", label: "Seg" }, { id: "2", label: "Ter" }, { id: "3", label: "Qua" }, { id: "4", label: "Qui" }, { id: "5", label: "Sex" }, { id: "6", label: "Sáb" }, { id: "0", label: "Dom" }];
  return <form onSubmit={(event) => { event.preventDefault(); void onSubmit({ action: "create_routine", title, description, clientId, frequency, intervalValue: 1, weekdays, dayOfMonth, dueOffsetDays, startsAt: nextRunAt, nextRunAt, endsAt, assignmentType, assigneeIds, teamIds }); }}><Modal title="Nova rotina recorrente" description="Cada ciclo gera uma demanda independente, sem apagar ou reutilizar o histórico anterior." onClose={onClose} footer={<ModalFooter onClose={onClose} submitLabel="Criar e ativar" working={working} />}><div className="space-y-6"><FormSection title="Modelo da demanda"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Título" required><input className={inputClass} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Relatório semanal de performance" required value={title} /></Field></div><div className="sm:col-span-2"><Field label="Descrição"><textarea className={textareaClass} onChange={(event) => setDescription(event.target.value)} value={description} /></Field></div><Field label="Cliente"><select className={inputClass} onChange={(event) => setClientId(event.target.value)} required value={clientId}>{activeClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field><Field label="Prazo após geração"><div className="relative"><input className={`${inputClass} pr-14`} min={0} onChange={(event) => setDueOffsetDays(Number(event.target.value))} type="number" value={dueOffsetDays} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">dias</span></div></Field></div></FormSection><FormSection title="Periodicidade"><div className="grid gap-2 sm:grid-cols-3">{(["daily", "weekly", "monthly"] as const).map((value) => <button className={`rounded-xl border px-3 py-3 text-[11px] font-semibold ${frequency === value ? "border-[#0069FE] bg-blue-50 text-[#0069FE]" : "border-slate-200 text-slate-500"}`} key={value} onClick={() => setFrequency(value)} type="button">{value === "daily" ? "Diária" : value === "weekly" ? "Semanal" : "Mensal"}</button>)}</div>{frequency === "weekly" && <div className="mt-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Dias da semana</p><div className="flex flex-wrap gap-2">{dayOptions.map((day) => { const active = weekdays.includes(day.id); return <button className={`h-9 w-11 rounded-xl border text-[10px] font-semibold ${active ? "border-[#0069FE] bg-[#0069FE] text-white" : "border-slate-200 text-slate-500"}`} key={day.id} onClick={() => setWeekdays(active ? weekdays.filter((item) => item !== day.id) : [...weekdays, day.id])} type="button">{day.label}</button>; })}</div></div>}{frequency === "monthly" && <div className="mt-4 max-w-xs"><Field label="Dia do mês"><input className={inputClass} max={31} min={1} onChange={(event) => setDayOfMonth(Number(event.target.value))} type="number" value={dayOfMonth} /></Field></div>}<div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Primeira ocorrência" required><input className={inputClass} min={dateKey()} onChange={(event) => setNextRunAt(event.target.value)} required type="date" value={nextRunAt} /></Field><Field label="Encerrar em" hint="Opcional"><input className={inputClass} min={nextRunAt} onChange={(event) => setEndsAt(event.target.value)} type="date" value={endsAt} /></Field></div></FormSection><FormSection title="Visibilidade e responsáveis"><div className="grid gap-2 sm:grid-cols-2"><ToggleCard description="Gera demandas para pessoas específicas." icon={UserRound} onClick={() => setAssignmentType("individual")} selected={assignmentType === "individual"} title="Individual" /><ToggleCard description="Compartilha com equipes inteiras." icon={Users} onClick={() => setAssignmentType("collective")} selected={assignmentType === "collective"} title="Coletiva" /></div><div className="mt-4 space-y-4"><CheckGrid items={data.users.filter((user) => user.active)} onChange={setAssigneeIds} selected={assigneeIds} type="user" /><CheckGrid items={data.teams} onChange={setTeamIds} selected={teamIds} type="team" /></div></FormSection></div></Modal></form>;
}
