import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { ProxyOptions } from 'vite';

// The backend is split across two independently-deployed services: an
// "ingestion" service (only the /ingestion* paths) and a "query" service
// (/auth*, /query*, /chat*). In dev we proxy each prefix to its own target so
// the browser talks to the SPA origin and avoids CORS.
//
// NOTE: the SPA also has a client-side route at "/chat", which collides with
// the "/chat" API prefix. Every backend endpoint is POST-only, so we only
// proxy POST requests here — a plain GET (full page load / hard refresh of
// /chat) falls through to Vite's own server and gets the SPA's index.html
// instead of being forwarded to the API (which would 404 on a bare GET).
const INGESTION_PREFIXES = ['/ingestion'];
const QUERY_PREFIXES = ['/auth', '/query', '/chat'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const ingestionTarget = env.VITE_DEV_PROXY_INGESTION_TARGET || 'http://localhost:8000';
  const queryTarget = env.VITE_DEV_PROXY_QUERY_TARGET || 'http://localhost:8000';

  const makeProxy = (target: string): ProxyOptions => ({
    target,
    changeOrigin: true,
    bypass: (req) => (req.method === 'POST' ? undefined : req.url),
  });

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        ...Object.fromEntries(INGESTION_PREFIXES.map((p) => [p, makeProxy(ingestionTarget)])),
        ...Object.fromEntries(QUERY_PREFIXES.map((p) => [p, makeProxy(queryTarget)])),
      },
    },
  };
});
