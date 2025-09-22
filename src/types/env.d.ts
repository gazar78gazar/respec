/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY?: string
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_GOOGLE_AI_API_KEY?: string
  readonly VITE_LLM_PROVIDER?: 'openai' | 'anthropic' | 'google'
  readonly VITE_LLM_MODEL?: string
  readonly VITE_LLM_TEMPERATURE?: string
  readonly VITE_LLM_MAX_TOKENS?: string
  readonly VITE_USE_LLM?: string
  readonly VITE_FALLBACK_TO_RULES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}