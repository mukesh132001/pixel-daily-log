// Settings for connecting to outside services. Everything here is safe to be public.
// Never put a Client Secret in this file: it belongs in Cloudflare.

export const STRAVA_CLIENT_ID = "289322";

// Your Cloudflare Worker's address, like "https://pixel-daily-log-strava.yourname.workers.dev".
// Leave it empty until the worker is deployed; the Strava button stays hidden until then.
export const WORKER_URL = "https://pixel-daily-log-strava.mukeshethiraj0.workers.dev";

// Supabase, for optional sign-in (so a profile can be restored on any device). Both values are public:
// the anon key only allows what the database's Row Level Security rules allow (see supabase/profiles.sql).
// Never put the service_role (secret) key here. Leave these empty and sign-in stays hidden.
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
