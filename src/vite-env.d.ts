/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INGESTION_API_BASE_URL?: string;
  readonly VITE_QUERY_API_BASE_URL?: string;
  readonly VITE_DEV_PROXY_INGESTION_TARGET?: string;
  readonly VITE_DEV_PROXY_QUERY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
