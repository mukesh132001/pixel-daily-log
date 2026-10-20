// Settings for connecting to outside services. Everything here is safe to be public.
// Never put a Client Secret in this file: it belongs in Cloudflare.

export const STRAVA_CLIENT_ID = "289322";

// Your Cloudflare Worker's address, like "https://pixel-daily-log-strava.yourname.workers.dev".
// Leave it empty until the worker is deployed; the Strava button stays hidden until then.
export const WORKER_URL = "";
