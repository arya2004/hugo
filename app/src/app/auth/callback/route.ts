import { NextResponse } from 'next/server';
import { serverClient } from '../../../lib/supabase/server';
import { appOrigin } from '../../../server/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const code = params.get('code');
  const requested = params.get('next') ?? '/contributor';
  const next = /^\/(admin|contributor)(\/|$)/.test(requested)
    ? requested
    : '/contributor';
  if (code) {
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${appOrigin()}${next}`);
    }
  }
  return NextResponse.redirect(`${appOrigin()}/?auth=failed`);
}
