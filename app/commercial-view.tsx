"use client";

import {
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileSignature,
  Handshake,
  LoaderCircle,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Target,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import type {
  AppData,
  AppUser,
  ContractStatus,
  MeetingStatus,
  OpportunityStage,
  SalesContract,
  SalesMeeting,
  SalesOpportunity,
} from "./lib/types";

type ActionPayload = Record<string, unknown> & { action: string };
type CommercialTab = "pipeline" | "meetings" | "contracts";

const stageMeta: Record<OpportunityStage, { label: string; dot: string }> = {
  lead: { label: "Entrada", dot: "bg-zinc-400" },
  contacted: { label: "Contato", dot: "bg-sky-400" },
  meeting: { label: "Reunião", dot: "bg-violet-400" },
  proposal: { label: "Proposta", dot: "bg-amber-400" },
  negotiation: { label: "Negociação", dot: "bg-orange-400" },
  won: { label: "Fechado", dot: "bg-emerald-400" },
  lost: { label: "Perdido", dot: "bg-rose-400" },
};

const contractMeta: Record<ContractStatus, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-zinc-800 text-zinc-300" },
  sent: { label: "Enviado", className: "bg-sky-500/10 text-sky-300" },
  signed: { label: "Assinado", className: "bg-violet-500/10 text-violet-300" },
  active: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-300" },
  expiring: { label: "Vencendo", className: "bg-amber-500/10 text-amber-300" },
  ended: { label: "Encerrado", className: "bg-zinc-800 text-zinc-400" },
  canceled: { label: "Cancelado", className: "bg-rose-500/10 text-rose-300" },
};

const meetingMeta: Record<MeetingStatus, { label: string; className: string }> = {
  scheduled: { label: "Agendada", className: "bg-zinc-800 text-zinc-200" },
  completed: { label: "Realizada", className: "bg-emerald-500/10 text-emerald-300" },
  canceled: { label: "Cancelada", className: "bg-rose-500/10 text-rose-300" },
};

function currency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
}

function moneyInput(cents: number) {
  return cents ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

function shortDate(value: string | null) {
  if (!value) return "Sem data";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

function meetingDate(value: string) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""),
    time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date),
    full: new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(date),
  };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function findUser(data: AppData, id: string) {
  return data.users.find((user) => user.id === id);
}

function defaultDateTime() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function CommercialView({
  data,
  search,
  canManage,
  working,
  onAction,
}: {
  data: AppData;
  search: string;
  canManage: boolean;
  working: boolean;
  onAction: (payload: ActionPayload, successMessage?: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<CommercialTab>("pipeline");
  const [agentId, setAgentId] = useState("all");
  const [opportunity, setOpportunity] = useState<SalesOpportunity | "new" | null>(null);
  const [meeting, setMeeting] = useState<SalesMeeting | "new" | null>(null);
  const [contract, setContract] = useState<SalesContract | "new" | null>(null);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const users = data.users.filter((user) => user.active);

  const opportunities = useMemo(
    () => data.salesOpportunities.filter((item) => {
      const matchesAgent = agentId === "all" || item.owner_id === agentId;
      const haystack = `${item.company_name} ${item.contact_name ?? ""} ${item.service}`.toLocaleLowerCase("pt-BR");
      return matchesAgent && haystack.includes(query);
    }),
    [agentId, data.salesOpportunities, query],
  );
  const meetings = useMemo(
    () => data.salesMeetings.filter((item) => {
      const matchesAgent = agentId === "all" || item.responsible_id === agentId;
      return matchesAgent && `${item.title} ${item.company_name} ${item.participants}`.toLocaleLowerCase("pt-BR").includes(query);
    }),
    [agentId, data.salesMeetings, query],
  );
  const contracts = useMemo(
    () => data.salesContracts.filter((item) => {
      const matchesAgent = agentId === "all" || item.owner_id === agentId;
      return matchesAgent && `${item.title} ${item.company_name}`.toLocaleLowerCase("pt-BR").includes(query);
    }),
    [agentId, data.salesContracts, query],
  );

  const openPipeline = data.salesOpportunities.filter((item) => !["won", "lost"].includes(item.stage));
  const pipelineValue = openPipeline.reduce((sum, item) => sum + item.estimated_value, 0);
  const upcomingMeetings = data.salesMeetings.filter((item) => item.status === "scheduled" && new Date(item.starts_at) >= new Date()).length;
  const activeContracts = data.salesContracts.filter((item) => ["signed", "active", "expiring"].includes(item.status));
  const contractValue = activeContracts.reduce((sum, item) => sum + item.value, 0);

  const createCurrent = () => {
    if (tab === "pipeline") setOpportunity("new");
    if (tab === "meetings") setMeeting("new");
    if (tab === "contracts") setContract("new");
  };

  return (
    <div className="app-enter">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Relacionamento e receita</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-zinc-50 sm:text-3xl">Comercial & Vendas</h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-400">Acompanhe negociações, reuniões e contratos sem perder o próximo passo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-300 outline-none" onChange={(event) => setAgentId(event.target.value)} value={agentId}>
            <option value="all">Todos os responsáveis</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
          {canManage && <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-100 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-white" onClick={createCurrent} type="button"><Plus size={15} />{tab === "pipeline" ? "Nova oportunidade" : tab === "meetings" ? "Nova reunião" : "Novo contrato"}</button>}
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Target} label="Oportunidades abertas" value={String(openPipeline.length)} detail={currency(pipelineValue)} />
        <Metric icon={CalendarClock} label="Próximas reuniões" value={String(upcomingMeetings)} detail="agendadas" />
        <Metric icon={FileSignature} label="Contratos vigentes" value={String(activeContracts.length)} detail={currency(contractValue)} />
        <Metric icon={CircleDollarSign} label="Negócios fechados" value={String(data.salesOpportunities.filter((item) => item.stage === "won").length)} detail="histórico total" />
      </section>

      <div className="mt-6 flex w-fit rounded-xl border border-zinc-800 bg-zinc-950 p-1">
        {([
          ["pipeline", "Funil", Handshake],
          ["meetings", "Reuniões", CalendarClock],
          ["contracts", "Contratos", FileSignature],
        ] as const).map(([id, label, Icon]) => (
          <button className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${tab === id ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200"}`} key={id} onClick={() => setTab(id)} type="button"><Icon size={14} />{label}</button>
        ))}
      </div>

      {tab === "pipeline" && <Pipeline data={data} opportunities={opportunities} canManage={canManage} onOpen={setOpportunity} />}
      {tab === "meetings" && <Meetings data={data} meetings={meetings} canManage={canManage} onOpen={setMeeting} />}
      {tab === "contracts" && <Contracts data={data} contracts={contracts} canManage={canManage} onOpen={setContract} />}

      {opportunity && <OpportunityModal data={data} item={opportunity === "new" ? null : opportunity} working={working} onClose={() => setOpportunity(null)} onSubmit={async (payload) => { const ok = await onAction(payload, opportunity === "new" ? "Oportunidade criada." : "Oportunidade atualizada."); if (ok) setOpportunity(null); }} />}
      {meeting && <MeetingModal data={data} item={meeting === "new" ? null : meeting} working={working} onClose={() => setMeeting(null)} onSubmit={async (payload) => { const ok = await onAction(payload, meeting === "new" ? "Reunião agendada." : "Reunião atualizada."); if (ok) setMeeting(null); }} />}
      {contract && <ContractModal data={data} item={contract === "new" ? null : contract} working={working} onClose={() => setContract(null)} onSubmit={async (payload) => { const ok = await onAction(payload, contract === "new" ? "Contrato cadastrado." : "Contrato atualizado."); if (ok) setContract(null); }} />}
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Target; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</span><Icon className="text-zinc-600" size={16} /></div><div className="mt-3 flex items-baseline gap-2"><strong className="text-2xl font-semibold tracking-tight text-zinc-100">{value}</strong><span className="text-[10px] text-zinc-500">{detail}</span></div></div>;
}

function Pipeline({ data, opportunities, canManage, onOpen }: { data: AppData; opportunities: SalesOpportunity[]; canManage: boolean; onOpen: (item: SalesOpportunity) => void }) {
  const stages = Object.keys(stageMeta) as OpportunityStage[];
  return <div className="app-scrollbar mt-5 grid min-w-[1180px] grid-cols-7 gap-3 overflow-x-auto pb-3">{stages.map((stage) => {
    const items = opportunities.filter((item) => item.stage === stage);
    const total = items.reduce((sum, item) => sum + item.estimated_value, 0);
    return <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3" key={stage}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${stageMeta[stage].dot}`} /><h2 className="text-[11px] font-semibold text-zinc-300">{stageMeta[stage].label}</h2></div><span className="rounded-md bg-zinc-900 px-2 py-1 text-[9px] text-zinc-500">{items.length}</span></div><p className="mt-2 text-[10px] text-zinc-600">{currency(total)}</p><div className="mt-3 space-y-2">{items.map((item) => { const owner = findUser(data, item.owner_id); return <button className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-left transition hover:border-zinc-600" disabled={!canManage} key={item.id} onClick={() => onOpen(item)} type="button"><p className="line-clamp-2 text-[11px] font-semibold leading-4 text-zinc-100">{item.company_name}</p><p className="mt-1 truncate text-[9px] text-zinc-500">{item.service || "Serviço não informado"}</p><p className="mt-3 text-xs font-semibold text-zinc-300">{currency(item.estimated_value)}</p><div className="mt-3 flex items-center justify-between"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-semibold text-zinc-300" title={owner?.name}>{initials(owner?.name || "—")}</span><span className="text-[8px] text-zinc-600">{item.next_action_at ? `Próx. ${shortDate(item.next_action_at)}` : "Sem próximo passo"}</span></div></button>; })}{items.length === 0 && <div className="rounded-xl border border-dashed border-zinc-800 px-2 py-6 text-center text-[9px] text-zinc-600">Nenhuma oportunidade</div>}</div></section>;
  })}</div>;
}

function Meetings({ data, meetings, canManage, onOpen }: { data: AppData; meetings: SalesMeeting[]; canManage: boolean; onOpen: (item: SalesMeeting) => void }) {
  return <section className="mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"><div className="border-b border-zinc-800 px-5 py-4"><h2 className="text-sm font-semibold text-zinc-100">Agenda comercial</h2><p className="mt-1 text-[10px] text-zinc-500">{meetings.length} reuniões encontradas</p></div><div className="divide-y divide-zinc-800">{meetings.map((item) => { const date = meetingDate(item.starts_at); const responsible = findUser(data, item.responsible_id); return <button className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-zinc-900/50 sm:flex-row sm:items-center" disabled={!canManage} key={item.id} onClick={() => onOpen(item)} type="button"><div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"><strong className="text-lg leading-none text-zinc-100">{date.day}</strong><span className="mt-1 text-[9px] uppercase text-zinc-500">{date.month}</span></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-xs font-semibold text-zinc-100">{item.title}</h3><span className={`rounded-md px-2 py-1 text-[8px] font-semibold ${meetingMeta[item.status].className}`}>{meetingMeta[item.status].label}</span></div><p className="mt-1 text-[10px] text-zinc-500">{item.company_name} · {date.full}</p><div className="mt-2 flex flex-wrap gap-3 text-[9px] text-zinc-500"><span className="inline-flex items-center gap-1"><Clock3 size={11} />{date.time} · {item.duration_minutes} min</span><span className="inline-flex items-center gap-1">{item.meeting_type === "online" ? <Video size={11} /> : item.meeting_type === "phone" ? <Phone size={11} /> : <MapPin size={11} />}{item.location || (item.meeting_type === "online" ? "Online" : "A definir")}</span></div></div><div className="flex items-center gap-2 sm:w-44"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-semibold text-zinc-300">{initials(responsible?.name || "—")}</span><span className="truncate text-[9px] text-zinc-500">{responsible?.name || "Sem responsável"}</span>{canManage && <Pencil className="ml-auto text-zinc-600" size={13} />}</div></button>; })}{meetings.length === 0 && <Empty icon={CalendarClock} title="Nenhuma reunião" text="Agende o primeiro encontro comercial para acompanhar o relacionamento." />}</div></section>;
}

function Contracts({ data, contracts, canManage, onOpen }: { data: AppData; contracts: SalesContract[]; canManage: boolean; onOpen: (item: SalesContract) => void }) {
  return <section className="mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"><div className="border-b border-zinc-800 px-5 py-4"><h2 className="text-sm font-semibold text-zinc-100">Carteira de contratos</h2><p className="mt-1 text-[10px] text-zinc-500">{contracts.length} contratos encontrados</p></div><div className="divide-y divide-zinc-800">{contracts.map((item) => { const owner = findUser(data, item.owner_id); return <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center" key={item.id}><button className="min-w-0 flex-1 text-left" disabled={!canManage} onClick={() => onOpen(item)} type="button"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-xs font-semibold text-zinc-100">{item.title}</h3><span className={`rounded-md px-2 py-1 text-[8px] font-semibold ${contractMeta[item.status].className}`}>{contractMeta[item.status].label}</span></div><p className="mt-1 text-[10px] text-zinc-500">{item.company_name}</p></button><div className="sm:w-36"><p className="text-xs font-semibold text-zinc-200">{currency(item.value)}</p><p className="mt-1 text-[9px] text-zinc-600">{item.billing_cycle === "monthly" ? "mensal" : item.billing_cycle === "annual" ? "anual" : item.billing_cycle === "quarterly" ? "trimestral" : "pagamento único"}</p></div><div className="sm:w-40"><p className="text-[9px] text-zinc-500">{item.start_date ? shortDate(item.start_date) : "Sem início"} <ChevronRight className="inline" size={10} /> {item.end_date ? shortDate(item.end_date) : "Sem término"}</p><p className="mt-1 truncate text-[9px] text-zinc-600">{owner?.name || "Sem responsável"}</p></div><div className="flex items-center gap-2">{item.document_url && <a aria-label={`Abrir ${item.title}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-200" href={item.document_url} rel="noreferrer" target="_blank"><ExternalLink size={13} /></a>}{canManage && <button aria-label={`Editar ${item.title}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-200" onClick={() => onOpen(item)} type="button"><Pencil size={13} /></button>}</div></div>; })}{contracts.length === 0 && <Empty icon={FileSignature} title="Nenhum contrato" text="Cadastre contratos enviados, ativos ou próximos do vencimento." />}</div></section>;
}

function Empty({ icon: Icon, title, text }: { icon: typeof CalendarClock; title: string; text: string }) {
  return <div className="px-6 py-12 text-center"><Icon className="mx-auto text-zinc-700" size={28} /><p className="mt-3 text-xs font-semibold text-zinc-300">{title}</p><p className="mx-auto mt-1 max-w-sm text-[10px] leading-5 text-zinc-600">{text}</p></div>;
}

const inputClass = "h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none";
const textareaClass = "min-h-24 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs leading-5 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</span>{children}{hint && <span className="mt-1 block text-[9px] text-zinc-600">{hint}</span>}</label>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-t border-zinc-800 pt-5 first:border-0 first:pt-0"><h3 className="text-xs font-semibold text-zinc-200">{title}</h3><div className="mt-4">{children}</div></section>;
}

function Modal({ title, description, onClose, children, working }: { title: string; description: string; onClose: () => void; children: ReactNode; working: boolean }) {
  return <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"><button aria-label="Fechar" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} type="button" /><section className="relative z-10 flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-3xl"><header className="flex items-start justify-between border-b border-zinc-800 px-5 py-5 sm:px-6"><div><h2 className="text-lg font-semibold tracking-tight text-zinc-50">{title}</h2><p className="mt-1 text-[10px] leading-5 text-zinc-500">{description}</p></div><button aria-label="Fechar" className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800" onClick={onClose} type="button"><X size={17} /></button></header><div className="app-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div><footer className="flex items-center justify-end gap-2 border-t border-zinc-800 bg-zinc-950/50 px-5 py-4 sm:px-6"><button className="h-10 rounded-xl px-4 text-xs font-semibold text-zinc-500 hover:bg-zinc-800" onClick={onClose} type="button">Cancelar</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-100 px-4 text-xs font-semibold text-zinc-950 disabled:opacity-50" disabled={working} form="commercial-form" type="submit">{working ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />}Salvar</button></footer></section></div>;
}

function UserOptions({ users }: { users: AppUser[] }) {
  return <>{users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</>;
}

function OpportunityModal({ data, item, working, onClose, onSubmit }: { data: AppData; item: SalesOpportunity | null; working: boolean; onClose: () => void; onSubmit: (payload: ActionPayload) => Promise<void> }) {
  const [companyName, setCompanyName] = useState(item?.company_name ?? "");
  const [contactName, setContactName] = useState(item?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(item?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(item?.contact_phone ?? "");
  const [service, setService] = useState(item?.service ?? "");
  const [estimatedValue, setEstimatedValue] = useState(moneyInput(item?.estimated_value ?? 0));
  const [stage, setStage] = useState<OpportunityStage>(item?.stage ?? "lead");
  const [ownerId, setOwnerId] = useState(item?.owner_id ?? data.currentUser.id);
  const [nextActionAt, setNextActionAt] = useState(item?.next_action_at ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [lossReason, setLossReason] = useState(item?.loss_reason ?? "");
  const submit = (event: FormEvent) => { event.preventDefault(); void onSubmit({ action: "save_opportunity", id: item?.id, companyName, contactName, contactEmail, contactPhone, service, estimatedValue, stage, ownerId, nextActionAt, notes, lossReason }); };
  return <Modal description="Registre o contato, valor estimado e o próximo passo da negociação." onClose={onClose} title={item ? "Editar oportunidade" : "Nova oportunidade"} working={working}><form className="space-y-6" id="commercial-form" onSubmit={submit}><Section title="Empresa e contato"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Empresa"><input className={inputClass} onChange={(event) => setCompanyName(event.target.value)} required value={companyName} /></Field></div><Field label="Pessoa de contato"><input className={inputClass} onChange={(event) => setContactName(event.target.value)} value={contactName} /></Field><Field label="Telefone"><input className={inputClass} onChange={(event) => setContactPhone(event.target.value)} value={contactPhone} /></Field><div className="sm:col-span-2"><Field label="E-mail"><input className={inputClass} onChange={(event) => setContactEmail(event.target.value)} type="email" value={contactEmail} /></Field></div></div></Section><Section title="Negociação"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Serviço de interesse"><input className={inputClass} onChange={(event) => setService(event.target.value)} placeholder="Ex.: Gestão de tráfego e social media" value={service} /></Field></div><Field label="Valor estimado"><input className={inputClass} inputMode="decimal" onChange={(event) => setEstimatedValue(event.target.value)} placeholder="0,00" value={estimatedValue} /></Field><Field label="Etapa"><select className={inputClass} onChange={(event) => setStage(event.target.value as OpportunityStage)} value={stage}>{Object.entries(stageMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></Field><Field label="Responsável"><select className={inputClass} onChange={(event) => setOwnerId(event.target.value)} value={ownerId}><UserOptions users={data.users} /></select></Field><Field label="Próximo contato"><input className={inputClass} onChange={(event) => setNextActionAt(event.target.value)} type="date" value={nextActionAt} /></Field>{stage === "lost" && <div className="sm:col-span-2"><Field label="Motivo da perda"><input className={inputClass} onChange={(event) => setLossReason(event.target.value)} value={lossReason} /></Field></div>}<div className="sm:col-span-2"><Field label="Observações"><textarea className={textareaClass} onChange={(event) => setNotes(event.target.value)} value={notes} /></Field></div></div></Section></form></Modal>;
}

function MeetingModal({ data, item, working, onClose, onSubmit }: { data: AppData; item: SalesMeeting | null; working: boolean; onClose: () => void; onSubmit: (payload: ActionPayload) => Promise<void> }) {
  const [opportunityId, setOpportunityId] = useState(item?.opportunity_id ?? "");
  const initialOpportunity = data.salesOpportunities.find((opportunity) => opportunity.id === opportunityId);
  const [title, setTitle] = useState(item?.title ?? "Reunião comercial");
  const [companyName, setCompanyName] = useState(item?.company_name ?? initialOpportunity?.company_name ?? "");
  const [startsAt, setStartsAt] = useState(item?.starts_at.slice(0, 16) ?? defaultDateTime());
  const [durationMinutes, setDurationMinutes] = useState(item?.duration_minutes ?? 60);
  const [meetingType, setMeetingType] = useState(item?.meeting_type ?? "online");
  const [location, setLocation] = useState(item?.location ?? "");
  const [participants, setParticipants] = useState(item?.participants ?? "");
  const [agenda, setAgenda] = useState(item?.agenda ?? "");
  const [outcome, setOutcome] = useState(item?.outcome ?? "");
  const [status, setStatus] = useState<MeetingStatus>(item?.status ?? "scheduled");
  const [responsibleId, setResponsibleId] = useState(item?.responsible_id ?? data.currentUser.id);
  const selectOpportunity = (id: string) => { setOpportunityId(id); const selected = data.salesOpportunities.find((opportunity) => opportunity.id === id); if (selected) setCompanyName(selected.company_name); };
  const submit = (event: FormEvent) => { event.preventDefault(); void onSubmit({ action: "save_sales_meeting", id: item?.id, opportunityId, title, companyName, startsAt, durationMinutes, meetingType, location, participants, agenda, outcome, status, responsibleId }); };
  return <Modal description="Centralize pauta, participantes, link e resultado da conversa." onClose={onClose} title={item ? "Editar reunião" : "Nova reunião"} working={working}><form className="space-y-6" id="commercial-form" onSubmit={submit}><Section title="Agendamento"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Oportunidade relacionada" hint="Opcional"><select className={inputClass} onChange={(event) => selectOpportunity(event.target.value)} value={opportunityId}><option value="">Sem oportunidade vinculada</option>{data.salesOpportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.company_name}</option>)}</select></Field></div><div className="sm:col-span-2"><Field label="Título"><input className={inputClass} onChange={(event) => setTitle(event.target.value)} required value={title} /></Field></div><Field label="Empresa"><input className={inputClass} onChange={(event) => setCompanyName(event.target.value)} required value={companyName} /></Field><Field label="Responsável"><select className={inputClass} onChange={(event) => setResponsibleId(event.target.value)} value={responsibleId}><UserOptions users={data.users} /></select></Field><Field label="Data e hora"><input className={inputClass} onChange={(event) => setStartsAt(event.target.value)} required type="datetime-local" value={startsAt} /></Field><Field label="Duração"><select className={inputClass} onChange={(event) => setDurationMinutes(Number(event.target.value))} value={durationMinutes}><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>1 hora</option><option value={90}>1h30</option><option value={120}>2 horas</option></select></Field><Field label="Formato"><select className={inputClass} onChange={(event) => setMeetingType(event.target.value as SalesMeeting["meeting_type"])} value={meetingType}><option value="online">Online</option><option value="presential">Presencial</option><option value="phone">Ligação</option></select></Field><Field label="Link ou local"><input className={inputClass} onChange={(event) => setLocation(event.target.value)} value={location} /></Field><div className="sm:col-span-2"><Field label="Participantes"><input className={inputClass} onChange={(event) => setParticipants(event.target.value)} placeholder="Nomes ou e-mails separados por vírgula" value={participants} /></Field></div></div></Section><Section title="Registro da conversa"><div className="grid gap-4"><Field label="Pauta"><textarea className={textareaClass} onChange={(event) => setAgenda(event.target.value)} value={agenda} /></Field><Field label="Status"><select className={inputClass} onChange={(event) => setStatus(event.target.value as MeetingStatus)} value={status}><option value="scheduled">Agendada</option><option value="completed">Realizada</option><option value="canceled">Cancelada</option></select></Field>{status === "completed" && <Field label="Resultado e próximos passos"><textarea className={textareaClass} onChange={(event) => setOutcome(event.target.value)} value={outcome} /></Field>}</div></Section></form></Modal>;
}

function ContractModal({ data, item, working, onClose, onSubmit }: { data: AppData; item: SalesContract | null; working: boolean; onClose: () => void; onSubmit: (payload: ActionPayload) => Promise<void> }) {
  const [opportunityId, setOpportunityId] = useState(item?.opportunity_id ?? "");
  const [clientId, setClientId] = useState(item?.client_id ?? "");
  const [companyName, setCompanyName] = useState(item?.company_name ?? "");
  const [title, setTitle] = useState(item?.title ?? "Contrato de prestação de serviços");
  const [value, setValue] = useState(moneyInput(item?.value ?? 0));
  const [billingCycle, setBillingCycle] = useState(item?.billing_cycle ?? "monthly");
  const [startDate, setStartDate] = useState(item?.start_date ?? "");
  const [endDate, setEndDate] = useState(item?.end_date ?? "");
  const [status, setStatus] = useState<ContractStatus>(item?.status ?? "draft");
  const [documentUrl, setDocumentUrl] = useState(item?.document_url ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [ownerId, setOwnerId] = useState(item?.owner_id ?? data.currentUser.id);
  const selectOpportunity = (id: string) => { setOpportunityId(id); const selected = data.salesOpportunities.find((opportunity) => opportunity.id === id); if (selected) { setCompanyName(selected.company_name); if (!value) setValue(moneyInput(selected.estimated_value)); } };
  const selectClient = (id: string) => { setClientId(id); const selected = data.clients.find((client) => client.id === id); if (selected) setCompanyName(selected.name); };
  const submit = (event: FormEvent) => { event.preventDefault(); void onSubmit({ action: "save_contract", id: item?.id, opportunityId, clientId, companyName, title, value, billingCycle, startDate, endDate, status, documentUrl, notes, ownerId }); };
  return <Modal description="Acompanhe assinatura, vigência, valor e acesso ao documento." onClose={onClose} title={item ? "Editar contrato" : "Novo contrato"} working={working}><form className="space-y-6" id="commercial-form" onSubmit={submit}><Section title="Identificação"><div className="grid gap-4 sm:grid-cols-2"><Field label="Oportunidade" hint="Opcional"><select className={inputClass} onChange={(event) => selectOpportunity(event.target.value)} value={opportunityId}><option value="">Sem oportunidade</option>{data.salesOpportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.company_name}</option>)}</select></Field><Field label="Cliente existente" hint="Opcional"><select className={inputClass} onChange={(event) => selectClient(event.target.value)} value={clientId}><option value="">Sem cliente vinculado</option>{data.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field><Field label="Empresa"><input className={inputClass} onChange={(event) => setCompanyName(event.target.value)} required value={companyName} /></Field><Field label="Responsável"><select className={inputClass} onChange={(event) => setOwnerId(event.target.value)} value={ownerId}><UserOptions users={data.users} /></select></Field><div className="sm:col-span-2"><Field label="Nome do contrato"><input className={inputClass} onChange={(event) => setTitle(event.target.value)} required value={title} /></Field></div></div></Section><Section title="Condições e vigência"><div className="grid gap-4 sm:grid-cols-2"><Field label="Valor"><input className={inputClass} inputMode="decimal" onChange={(event) => setValue(event.target.value)} placeholder="0,00" value={value} /></Field><Field label="Cobrança"><select className={inputClass} onChange={(event) => setBillingCycle(event.target.value as SalesContract["billing_cycle"])} value={billingCycle}><option value="one_time">Pagamento único</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="annual">Anual</option></select></Field><Field label="Início"><input className={inputClass} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></Field><Field label="Término"><input className={inputClass} min={startDate} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} /></Field><Field label="Status"><select className={inputClass} onChange={(event) => setStatus(event.target.value as ContractStatus)} value={status}>{Object.entries(contractMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></Field><Field label="Link do documento"><input className={inputClass} onChange={(event) => setDocumentUrl(event.target.value)} placeholder="https://..." type="url" value={documentUrl} /></Field><div className="sm:col-span-2"><Field label="Observações"><textarea className={textareaClass} onChange={(event) => setNotes(event.target.value)} value={notes} /></Field></div></div></Section></form></Modal>;
}
