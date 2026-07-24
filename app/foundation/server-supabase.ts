import { createClient } from "@supabase/supabase-js";
import {
  assertServerConfiguration,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./config";
import type { Database } from "./database.types";

export async function getAuthenticatedSupabase(request: Request) {
  assertServerConfiguration();
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authorization.slice("Bearer ".length).trim();
  if (!accessToken) return null;

  const client = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const {
    data: { user },
    error,
  } = await client.auth.getUser(accessToken);
  if (error || !user) return null;

  return { client, user, accessToken };
}

export function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
