"use client";

import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./config";
import type { Database } from "./database.types";

let browserClient: ReturnType<typeof createClient<Database>> | null = null;

const TAB_ID_KEY = "hum-auth-tab-id";

export function browserRandomId() {
  const browserCrypto = globalThis.crypto;

  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  if (typeof browserCrypto?.getRandomValues === "function") {
    const values = browserCrypto.getRandomValues(new Uint32Array(4));
    return Array.from(values, (value) => value.toString(16).padStart(8, "0"))
      .join("-");
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

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
    tabId = browserRandomId();
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
