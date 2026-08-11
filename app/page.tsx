import { LockKeyhole, LogOut, ShieldX, Sparkles } from "lucide-react";
import { AgencyApp } from "./agency-app";
import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { getRequestIdentity } from "./lib/server-auth";
import { ensureCurrentUser, UserAccessError } from "./lib/server-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getRequestIdentity();

  if (!identity) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-5 py-12">
        <section className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,36,79,0.12)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00113B] text-white">
            <LockKeyhole aria-hidden="true" size={24} />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#0069FE]">
            Central da agência
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#00113B]">
            Sua operação, em um só lugar.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Entre para acessar clientes, demandas, equipes, rotinas e todo o histórico operacional.
          </p>
          <a
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0069FE] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0058d6]"
            href={chatGPTSignInPath("/")}
          >
            <Sparkles aria-hidden="true" size={17} />
            Entrar com ChatGPT
          </a>
        </section>
      </main>
    );
  }

  try {
    await ensureCurrentUser(identity);
  } catch (error) {
    if (!(error instanceof UserAccessError)) throw error;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-5 py-12">
        <section className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
            <ShieldX aria-hidden="true" size={25} />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#0069FE]">
            Acesso não liberado
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#00113B]">
            Fale com a gestão da agência.
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error.message} Peça para cadastrarem exatamente o e-mail <strong>{identity.email}</strong> na área Equipe.
          </p>
          <a
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-50"
            href={chatGPTSignOutPath("/")}
          >
            <LogOut aria-hidden="true" size={17} />
            Entrar com outro e-mail
          </a>
        </section>
      </main>
    );
  }

  return <AgencyApp />;
}
