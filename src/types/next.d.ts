import 'next'
import 'next/headers'
import '@supabase/ssr'

declare module 'next/headers' {
  interface ReadonlyRequestCookies {
    getAll: () => { name: string; value: string }[]
  }
}

// Definir explícitamente los tipos de la nueva API para evitar errores
declare module '@supabase/ssr' {
  import { SupabaseClient } from '@supabase/supabase-js'
  
  export interface SupabaseClientOptions {
    supabaseUrl: string;
    supabaseKey: string;
    cookies: {
      getAll: () => { name: string; value: string }[];
      setAll: (cookies: { name: string; value: string; options?: any }[]) => void;
    };
  }
  
  export function createServerClient<Database = any>(
    options: SupabaseClientOptions
  ): SupabaseClient<Database>;
  
  export function createBrowserClient<Database = any>(
    options: {
      supabaseUrl: string;
      supabaseKey: string;
    }
  ): SupabaseClient<Database>;
} 