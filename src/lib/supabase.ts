import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export const isSupabaseConfigured = Boolean(url && anonKey)

/** 未配置环境变量时为 null，界面会显示配置指引而不是直接崩溃 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null
