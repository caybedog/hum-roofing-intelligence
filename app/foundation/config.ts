export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://rpmsyoptaqsnznrwgbzq.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_tnTrh8K4lFrVYpl0HtxX7A_pxJGHC8A";

export const PHOTO_BUCKET = "project-photos";
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const OPENAI_MODEL =
  process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

export function assertServerConfiguration() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase configuration is unavailable.");
  }
}
