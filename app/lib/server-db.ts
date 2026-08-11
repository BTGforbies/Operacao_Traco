export const WORKSPACE_ID = "workspace-traco61";

type RuntimeEnv = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

function runtimeEnv(): RuntimeEnv {
  const value = (
    globalThis as typeof globalThis & {
      __CENTRAL_RUNTIME_ENV__?: RuntimeEnv;
    }
  ).__CENTRAL_RUNTIME_ENV__;
  if (!value) throw new Error("Serviços de persistência indisponíveis.");
  return value;
}

export function getD1(): D1Database {
  const database = runtimeEnv().DB;
  if (!database) throw new Error("Banco de dados indisponível.");
  return database;
}

export function getBucket(): R2Bucket {
  const bucket = runtimeEnv().BUCKET;
  if (!bucket) throw new Error("Armazenamento de arquivos indisponível.");
  return bucket;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function localDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
