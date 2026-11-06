import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '../src/app/auth/callback/route';

vi.mock('../src/lib/supabase/server', () => ({
  serverClient: async () => ({
    auth: { exchangeCodeForSession: async () => ({ error: null }) },
  }),
}));

afterEach(() => vi.unstubAllEnvs());

it.each(['https://hugo-three-amber.vercel.app', 'http://localhost:3000'])(
  'keeps successful OAuth callbacks on %s even with a stale app URL',
  async (origin) => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:9999');
    const response = await GET(new Request(`${origin}/auth/callback?code=test-code&next=/admin`));
    expect(response.headers.get('location')).toBe(`${origin}/admin`);
  },
);

it('keeps a failed callback on the requesting domain', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:9999');
  const response = await GET(new Request('https://hugo-three-amber.vercel.app/auth/callback'));
  expect(response.headers.get('location')).toBe('https://hugo-three-amber.vercel.app/?auth=failed');
});
