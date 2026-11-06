import { NextResponse } from 'next/server';
import { serverClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const code = params.get('code');
  const requested = params.get('next') ?? '/contributor';
  const next = /^\/(admin|contributor)(\/|$)/.test(requested)
    ? requested
    : '/contributor';
  if (code) {
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL('/?auth=failed', url.origin));
}
