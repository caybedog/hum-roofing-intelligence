"use client";

import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./config";
import type { Database } from "./database.types";

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

const TAB_ID_KEY = "hum-auth-tab-id";

function authSlot() {
  if (typeof window === "undefined") return "server";
  const requestedSlot = new URLSearchParams(window.location.search)
    .get("auth_slot")
    ?.toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30);
  if (requestedSlot) return requestedSlot;

  let tabId = window.sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = window.crypto.randomUUID();
    window.sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return tabId;
}

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage:
            typeof window === "undefined" ? undefined : window.sessionStorage,
          storageKey: `hum-auth-${authSlot()}`,
        },
      },
    );
  }
  return browserClient;
}
