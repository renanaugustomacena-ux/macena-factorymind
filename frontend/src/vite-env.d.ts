/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_MQTT_WS_URL: string;
  readonly VITE_DEFAULT_FACILITY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
