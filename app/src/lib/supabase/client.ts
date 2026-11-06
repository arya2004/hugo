'use client';
import { createBrowserClient } from '@supabase/ssr';

export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw Error('Configure Supabase OAuth first');
  }
  return createBrowserClient(url, key);
}
