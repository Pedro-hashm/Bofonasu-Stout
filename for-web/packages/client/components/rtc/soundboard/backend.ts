import { createClient } from "@supabase/supabase-js";

/** Public configuration only. No bot token or administrative key belongs here. */
export const projectURL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://neqwcspfgisgdlprowho.supabase.co";
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_nQEVlIJh-KNWpzmCTFaZHA_vpQ5hnl9";
export function soundboardBackend(account: string) {
  return createClient(projectURL, publishableKey, {
    auth: {
      storageKey: `bofonasu-soundboard:${new URL(projectURL).hostname}:${account}`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });
}
export type SoundBackend = ReturnType<typeof soundboardBackend>;
