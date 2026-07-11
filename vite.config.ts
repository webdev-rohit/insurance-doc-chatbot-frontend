import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { ProxyOptions } from 'vite';

// The backend mounts four routers at these prefixes. In dev we proxy them to the
// FastAPI server so the browser talks to the SPA origin and avoids CORS.
//
// NOTE: the SPA also has a client-side route at "/chat", which collides with
// the "/chat" API prefix. Every backend endpoint is POST-only, so we only
// proxy POST requests here — a plain GET (full page load / hard refresh of
// /chat) falls through to Vite's own server and gets the SPA's index.html
// instead of being forwarded to FastAPI (which would 404 on a bare GET).
const API_PREFIXES = ['/auth', '/ingestion', '/query', '/chat'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000';

  const proxyOptions: ProxyOptions = {
    target,
    changeOrigin: true,
    bypass: (req) => (req.method === 'POST' ? undefined : req.url),
  };

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: Object.fromEntries(API_PREFIXES.map((p) => [p, proxyOptions])),
    },
  };
});
