import { getChatGPTUser } from "@/app/chatgpt-auth";

const PROJECT_KEY = "sample-roofing-project-001";
const MAX_STATE_BYTES = 250_000;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS construction_records (
    owner_email TEXT NOT NULL,
    project_key TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (owner_email, project_key)
  )`,
];

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });

async function identifyOwner(request: Request) {
  const user = await getChatGPTUser();
  if (user?.email) return user.email.toLowerCase();

  const host = new URL(request.url).hostname;
  if (host === "terminal.local" || host === "localhost" || host === "127.0.0.1") {
    return "local-preview@hum.invalid";
  }

  return null;
}

async function getDatabase() {
  const { env } = await import("cloudflare:workers");
  return env.DB;
}

async function ensureSchema(database: D1Database) {
  await database.batch(
    schemaStatements.map((statement) => database.prepare(statement)),
  );
}

export async function GET(request: Request) {
  const ownerEmail = await identifyOwner(request);
  if (!ownerEmail) return json({ error: "Authentication required" }, 401);

  const database = await getDatabase();
  await ensureSchema(database);
  const record = await database
    .prepare(
      `SELECT state_json, updated_at
       FROM construction_records
       WHERE owner_email = ? AND project_key = ?
       LIMIT 1`,
    )
    .bind(ownerEmail, PROJECT_KEY)
    .first<{ state_json: string; updated_at: number }>();

  if (!record) return json({ state: null, updatedAt: null });

  try {
    return json({
      state: JSON.parse(record.state_json),
      updatedAt: record.updated_at,
    });
  } catch {
    return json({ error: "Saved construction state is unreadable" }, 500);
  }
}

export async function PUT(request: Request) {
  const ownerEmail = await identifyOwner(request);
  if (!ownerEmail) return json({ error: "Authentication required" }, 401);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const state =
    payload && typeof payload === "object" && "state" in payload
      ? (payload as { state: unknown }).state
      : null;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return json({ error: "A construction state object is required" }, 400);
  }

  const stateJson = JSON.stringify(state);
  if (new TextEncoder().encode(stateJson).byteLength > MAX_STATE_BYTES) {
    return json({ error: "Construction state is too large" }, 413);
  }

  const database = await getDatabase();
  await ensureSchema(database);
  const updatedAt = Date.now();
  await database
    .prepare(
      `INSERT INTO construction_records
        (owner_email, project_key, state_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_email, project_key)
       DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
    )
    .bind(ownerEmail, PROJECT_KEY, stateJson, updatedAt)
    .run();

  return json({ ok: true, updatedAt });
}
