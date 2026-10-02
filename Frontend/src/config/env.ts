/**
 * Validated frontend environment configuration.
 * Only VITE_ prefixed variables are exposed to the browser bundle.
 * Secrets such as SUPABASE_SERVICE_ROLE_KEY MUST NEVER be imported here.
 */
export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  APP_NAME: import.meta.env.VITE_APP_NAME || 'MediFusion AI',
  APP_DESCRIPTION:
    import.meta.env.VITE_APP_DESCRIPTION ||
    'Multimodal Clinical Intelligence with Adaptive AI Orchestration',
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
} as const;
