import { createClient } from '@supabase/supabase-js'
import { authLinkIntentFromUrl } from './auth-mode.js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
// Capturar solo el tipo antes de que el cliente Auth procese el enlace.
export const authLinkIntent = typeof window!=='undefined'
  ? authLinkIntentFromUrl(window.location.search,window.location.hash)
  : null
export const isConfigured = Boolean(url && key && /^https:\/\//i.test(url))
// Keep startup safe when the repository is deployed before backend credentials are added.
export const supabase = isConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
