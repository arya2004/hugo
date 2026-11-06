import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { AppError, required } from './env';

export function db() {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function query<T = any>(
  q: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T> {
  const { data, error } = await q;
  if (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
    if (code === '23505' || code === 'P0001') {
      throw new AppError(
        409,
        'STATE_CONFLICT',
        'This record changed or already exists. Refresh and retry.',
      );
    }
    if (code === '23514' || code === '22P02') {
      throw new AppError(
        422,
        'INVALID_STATE',
        'The requested update violates a data constraint.',
      );
    }
    throw new AppError(503, 'DATABASE_ERROR', 'Database operation failed');
  }
  return data as T;
}

export async function rpc<T = any>(name: string, args: Record<string, unknown>) {
  return query<T>(db().rpc(name, args));
}

export async function one(table: string, id: string): Promise<any> {
  const value = await query(
    db()
      .from(
        ['programs', 'donations', 'merge_reservations', 'merge_allocations'].includes(
          table,
        )
          ? `${table}_safe`
          : table,
      )
      .select('*')
      .eq('id', id)
      .maybeSingle(),
  );
  if (!value) {
    throw new AppError(404, 'NOT_FOUND', 'Record not found');
  }
  return value;
}
