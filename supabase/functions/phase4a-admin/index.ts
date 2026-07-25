import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const allowedOrigins = new Set([
  "https://hum-roofing-intelligence.vercel.app",
  "https://hum-roofing-intelligence.caybedog707.chatgpt.site",
  "http://localhost:5173",
]);

type CreateBody = {
  action: "create_rehearsal";
  label?: string;
};

type ResetBody = {
  action: "reset_rehearsal";
  runId?: string;
  confirmation?: string;
};

type RequestBody = CreateBody | ResetBody;

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin":
      origin && allowedOrigins.has(origin) ? origin : "",
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "cache-control": "no-store, max-age=0",
    "content-type": "application/json",
    vary: "Origin",
    "x-content-type-options": "nosniff",
  };
}

function json(
  origin: string | null,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const suffix = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `HuM-QA7!${suffix}`;
}

function qaEmail(role: "homeowner" | "contractor") {
  const stamp = Date.now();
  const nonce = crypto.randomUUID().slice(0, 8);
  return `hum.qa.${role}.${stamp}.${nonce}@example.invalid`;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) {
      return json(origin, { error: "Origin not allowed." }, 403);
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return json(origin, { error: "Method not allowed." }, 405);
  }

  if (origin && !allowedOrigins.has(origin)) {
    return json(origin, { error: "Origin not allowed." }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !authorization) {
    return json(origin, { error: "Secure server configuration unavailable." }, 503);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(
    authorization.replace(/^Bearer\s+/i, "").trim(),
  );

  if (userError || !user) {
    return json(origin, { error: "Authentication required." }, 401);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminProfile } = await service
    .from("profiles")
    .select("id,role,deactivated_at,is_test_account")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !adminProfile ||
    adminProfile.role !== "administrator" ||
    adminProfile.deactivated_at ||
    adminProfile.is_test_account
  ) {
    return json(origin, { error: "Administrator access required." }, 403);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json(origin, { error: "A valid request body is required." }, 400);
  }

  if (body.action === "create_rehearsal") {
    const label = body.label?.trim() || "Phase 4A end-to-end rehearsal";
    if (label.length < 3 || label.length > 120) {
      return json(origin, { error: "Label must be 3–120 characters." }, 400);
    }

    const homeownerEmail = qaEmail("homeowner");
    const contractorEmail = qaEmail("contractor");
    const homeownerPassword = randomPassword();
    const contractorPassword = randomPassword();
    let homeownerId = "";
    let contractorId = "";

    try {
      const { data: homeowner, error: homeownerError } =
        await service.auth.admin.createUser({
          email: homeownerEmail,
          password: homeownerPassword,
          email_confirm: true,
          user_metadata: { full_name: "HUM QA Homeowner" },
        });
      if (homeownerError || !homeowner.user) {
        throw homeownerError ?? new Error("Homeowner account creation failed.");
      }
      homeownerId = homeowner.user.id;

      const { data: contractor, error: contractorError } =
        await service.auth.admin.createUser({
          email: contractorEmail,
          password: contractorPassword,
          email_confirm: true,
          user_metadata: { full_name: "HUM QA Contractor" },
        });
      if (contractorError || !contractor.user) {
        throw contractorError ?? new Error("Contractor account creation failed.");
      }
      contractorId = contractor.user.id;

      const { error: homeownerProfileError } = await service
        .from("profiles")
        .update({
          full_name: "HUM QA Homeowner",
          role: "homeowner",
          service_area: "Humboldt County",
          is_test_account: true,
        })
        .eq("id", homeownerId);
      if (homeownerProfileError) throw homeownerProfileError;

      const { error: contractorProfileError } = await service
        .from("profiles")
        .update({
          full_name: "HUM QA Contractor",
          role: "contractor",
          service_area: "Humboldt County",
          is_test_account: true,
        })
        .eq("id", contractorId);
      if (contractorProfileError) throw contractorProfileError;

      const { error: pilotProfileError } = await service
        .from("pilot_contractor_profiles")
        .insert({
          contractor_id: contractorId,
          company_name: "HUM QA Roofing",
          service_area: "Humboldt County",
          status: "pending",
          onboarding_notes:
            "Disposable Phase 4A contractor. Approve manually during rehearsal.",
        });
      if (pilotProfileError) throw pilotProfileError;

      const { data: run, error: runError } = await service
        .from("qa_runs")
        .insert({
          created_by: user.id,
          label,
          homeowner_user_id: homeownerId,
          homeowner_email: homeownerEmail,
          contractor_user_id: contractorId,
          contractor_email: contractorEmail,
        })
        .select("*")
        .single();
      if (runError || !run) {
        throw runError ?? new Error("QA rehearsal record creation failed.");
      }

      await service.from("audit_events").insert({
        actor_id: user.id,
        action: "create",
        entity_type: "qa_run",
        entity_id: run.id,
        metadata: {
          test_data_only: true,
          credentials_persisted: false,
          recorded_at: new Date().toISOString(),
        },
      });

      return json(origin, {
        run,
        credentials: {
          homeowner: {
            email: homeownerEmail,
            password: homeownerPassword,
          },
          contractor: {
            email: contractorEmail,
            password: contractorPassword,
          },
        },
      });
    } catch {
      if (contractorId) {
        await service
          .from("pilot_contractor_profiles")
          .delete()
          .eq("contractor_id", contractorId);
        await service.from("profiles").delete().eq("id", contractorId);
        await service.auth.admin.deleteUser(contractorId);
      }
      if (homeownerId) {
        await service.from("profiles").delete().eq("id", homeownerId);
        await service.auth.admin.deleteUser(homeownerId);
      }
      return json(
        origin,
        { error: "The disposable QA accounts could not be created safely." },
        500,
      );
    }
  }

  if (body.action === "reset_rehearsal") {
    if (!body.runId || body.confirmation !== "RESET TEST FLOW") {
      return json(
        origin,
        { error: 'Type "RESET TEST FLOW" to confirm test-only cleanup.' },
        400,
      );
    }

    const { data: run, error: runError } = await service
      .from("qa_runs")
      .select("*")
      .eq("id", body.runId)
      .eq("status", "active")
      .maybeSingle();
    if (runError || !run) {
      return json(origin, { error: "Active QA rehearsal not found." }, 404);
    }

    const { data: projects } = await service
      .from("projects")
      .select("id")
      .eq("homeowner_id", run.homeowner_user_id)
      .eq("is_test", true);
    const projectIds = (projects ?? []).map((project) => project.id);

    if (projectIds.length) {
      const { data: photos } = await service
        .from("project_photos")
        .select("storage_path")
        .in("project_id", projectIds);
      const storagePaths = (photos ?? []).map((photo) => photo.storage_path);
      if (storagePaths.length) {
        const { error: storageError } = await service.storage
          .from("project-photos")
          .remove(storagePaths);
        if (storageError) {
          return json(
            origin,
            { error: "Test photo cleanup failed; no database data was removed." },
            500,
          );
        }
      }
    }

    const { data: resetRows, error: resetError } = await service.rpc(
      "reset_qa_run_data",
      { p_run_id: run.id, p_admin_id: user.id },
    );
    if (resetError) {
      return json(
        origin,
        { error: "Test data cleanup failed without affecting real pilot data." },
        500,
      );
    }

    const userDeletionErrors: string[] = [];
    for (const userId of [
      run.homeowner_user_id,
      run.contractor_user_id,
    ]) {
      const { error } = await service.auth.admin.deleteUser(userId);
      if (error) userDeletionErrors.push(userId);
    }

    return json(origin, {
      reset: true,
      removedProjectCount: resetRows?.[0]?.removed_project_count ?? 0,
      accountsDeleted: userDeletionErrors.length === 0,
    });
  }

  return json(origin, { error: "Unsupported administrator action." }, 400);
});
