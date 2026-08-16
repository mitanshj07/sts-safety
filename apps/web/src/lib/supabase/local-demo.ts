// apps/web/src/lib/supabase/local-demo.ts
// Well-known JWTs for `supabase start` / the local CLI demo project.
// They are public (signed with the default local JWT secret) — not cloud secrets.

export const LOCAL_SUPABASE_URL_DEFAULT = "http://127.0.0.1:54321";

export const LOCAL_SUPABASE_ANON_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const LOCAL_SUPABASE_SERVICE_ROLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const ANVIL_DEFAULT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export const ANVIL_DEFAULT_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
