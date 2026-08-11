import { getChatGPTUser } from "../chatgpt-auth";

export type RequestIdentity = {
  email: string;
  name: string;
};

export async function getRequestIdentity(): Promise<RequestIdentity | null> {
  const user = await getChatGPTUser();
  if (user) return { email: user.email.toLowerCase(), name: user.displayName };

  if (process.env.NODE_ENV !== "production") {
    return { email: "tiago@traco61.local", name: "Tiago Toledo" };
  }

  return null;
}
