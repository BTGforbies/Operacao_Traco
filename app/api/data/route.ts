import { getRequestIdentity } from "../../lib/server-auth";
import { ensureCurrentUser, getAppData, UserAccessError } from "../../lib/server-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await getRequestIdentity();
    if (!identity) {
      return Response.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const user = await ensureCurrentUser(identity);
    const data = await getAppData(user);
    return Response.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível carregar os dados.";
    return Response.json({ error: message }, { status: error instanceof UserAccessError ? 403 : 500 });
  }
}
