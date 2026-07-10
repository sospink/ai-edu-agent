/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DIFY_BASE_URL?: string;
  readonly VITE_DIFY_CHATBOT_TOKEN?: string;
  readonly VITE_DIFY_CHATBOT_TOKEN_ZH?: string;
  readonly VITE_DIFY_CHATBOT_TOKEN_EN?: string;
  readonly VITE_TERMINAL_TRANSPORT?: 'raw' | 'json';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
