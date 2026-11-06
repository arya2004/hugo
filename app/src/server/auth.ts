import 'server-only';
import { serverClient } from '../lib/supabase/server';
import { authorizeOwner } from '../lib/authorization';
import { githubIdentity } from '../lib/core';
import { db, one, query, rpc } from './db';
import { AppError } from './env';

export async function principal() {
  const client = await serverClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub) {
    throw new AppError(401, 'LOGIN_REQUIRED', 'Sign in with GitHub');
  }
  const { data: admin, error: adminError } = await db().auth.admin.getUserById(
    data.claims.sub,
  );
  if (adminError || !admin.user) {
    throw new AppError(401, 'LOGIN_REQUIRED', 'Session user unavailable');
  }
  try {
    return githubIdentity(admin.user, data.claims.sub);
  } catch {
    throw new AppError(
      403,
      'GITHUB_REQUIRED',
      'Verified numeric GitHub identity required',
    );
  }
}

export async function owner(id: string, p: Awaited<ReturnType<typeof principal>>) {
  const program = await one('programs', id);
  authorizeOwner(program, p);
  await linked(p.authUserId, program.owner_wallet);
  return program;
}

export async function linked(user: string, wallet: string) {
  const row = await query(
    db()
      .from('wallet_links')
      .select('*')
      .eq('auth_user_id', user)
      .eq('wallet_address', wallet.toLowerCase())
      .maybeSingle(),
  );
  if (!row) {
    throw new AppError(403, 'WALLET_REQUIRED', 'Verify this wallet first');
  }
  return row;
}

export async function throttle(subject: string, action: string, limit = 10) {
  const result = await rpc('rate_limit', {
    p_subject: subject,
    p_action: action,
    p_limit: limit,
  });
  if (!result) {
    throw new AppError(429, 'RATE_LIMITED', 'Try again in a minute');
  }
}
