/* ---------------------------------------------------------------
   Клиент Supabase.

   Ключи берутся из .env.local. Если их нет — клиент равен null, и
   приложение просто работает без синхронизации: всё сохраняется
   локально. Это нужно, чтобы апку можно было открыть и пользоваться
   ею до того, как заведён проект в Supabase.
   --------------------------------------------------------------- */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabaseUrl = url ?? "";
export const supabaseAnonKey = anonKey ?? "";

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Вход по ссылке из письма и возврат от Google должны срабатывать.
        detectSessionInUrl: true,
        // PKCE обязателен: при implicit-потоке Supabase возвращает токен в
        // #-части адреса, а её занимает роутер — вход бы просто ломался.
        flowType: "pkce",
        storageKey: "malysh.auth",
      },
    })
  : null;
