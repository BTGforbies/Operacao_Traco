import type { AppUser, Attachment } from "../../lib/types";
import { getRequestIdentity } from "../../lib/server-auth";
import { createId, getBucket, getD1, nowIso } from "../../lib/server-db";
import { canAccessTask, ensureCurrentUser, UserAccessError } from "../../lib/server-store";

export const dynamic = "force-dynamic";

async function user(): Promise<AppUser | null> {
  const identity = await getRequestIdentity();
  return identity ? ensureCurrentUser(identity) : null;
}

export async function POST(request: Request) {
  try {
    const current = await user();
    if (!current) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
    const form = await request.formData();
    const taskId = String(form.get("taskId") || "");
    const file = form.get("file");
    if (!(file instanceof File) || !taskId) {
      return Response.json({ error: "Selecione um arquivo." }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return Response.json({ error: "O arquivo deve ter no máximo 20 MB." }, { status: 400 });
    }
    if (!(await canAccessTask(current, taskId))) {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    const id = createId("attachment");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const objectKey = `tasks/${taskId}/${id}-${safeName}`;
    await getBucket().put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    await getD1()
      .prepare(
        "INSERT INTO attachments (id, task_id, user_id, file_name, object_key, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        id,
        taskId,
        current.id,
        file.name.slice(0, 220),
        objectKey,
        file.type || "application/octet-stream",
        file.size,
        nowIso(),
      )
      .run();
    return Response.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no envio do arquivo.";
    return Response.json({ error: message }, { status: error instanceof UserAccessError ? 403 : 500 });
  }
}

export async function GET(request: Request) {
  try {
    const current = await user();
    if (!current) return new Response("Autenticação necessária.", { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return new Response("Arquivo inválido.", { status: 400 });
    const attachment = await getD1()
      .prepare("SELECT * FROM attachments WHERE id = ?")
      .bind(id)
      .first<Attachment & { object_key: string }>();
    if (!attachment || !(await canAccessTask(current, attachment.task_id))) {
      return new Response("Arquivo não encontrado.", { status: 404 });
    }
    const object = await getBucket().get(attachment.object_key);
    if (!object) return new Response("Arquivo não encontrado.", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`,
    );
    headers.set("Cache-Control", "private, max-age=60");
    return new Response(object.body, { headers });
  } catch (error) {
    return new Response(
      error instanceof UserAccessError ? error.message : "Falha ao baixar o arquivo.",
      { status: error instanceof UserAccessError ? 403 : 500 },
    );
  }
}
