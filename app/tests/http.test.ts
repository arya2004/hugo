import { describe, it, expect, afterEach } from 'vitest';
import { z } from 'zod';
import { authorizeOwner } from '../src/lib/authorization';
import { bearer, body, sameOrigin, envelope } from '../src/server/http';

const oldOrigin = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  if (oldOrigin) {
    process.env.NEXT_PUBLIC_APP_URL = oldOrigin;
  } else {
    delete process.env.NEXT_PUBLIC_APP_URL;
  }
  delete process.env.TEST_MACHINE_SECRET;
});
describe('API boundaries', () => {
  it('rejects absent and incorrect bearer tokens', () => {
    process.env.TEST_MACHINE_SECRET = 't'.repeat(64);
    for (const authorization of ['', 'Bearer wrong']) {
      expect(() =>
        bearer(
          new Request('https://app.test', { headers: { authorization } }),
          'TEST_MACHINE_SECRET',
        ),
      ).toThrow();
    }
    expect(() =>
      bearer(
        new Request('https://app.test', {
          headers: { authorization: 'Bearer ' + 't'.repeat(64) },
        }),
        'TEST_MACHINE_SECRET',
      ),
    ).not.toThrow();
  });
  it('rejects cross-origin cookie writes and absent origins', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
    for (const origin of ['https://attacker.test', 'null', '']) {
      expect(() =>
        sameOrigin(new Request('https://app.test', { headers: { origin } })),
      ).toThrow();
    }
    expect(() =>
      sameOrigin(
        new Request('https://app.test', { headers: { origin: 'https://app.test' } }),
      ),
    ).not.toThrow();
  });
  it('enforces media type, body cap even without Content-Length and strict schema', async () => {
    const schema = z.object({ id: z.string() }).strict();
    const req = (v: string, type = 'application/json') =>
      new Request('https://app.test', {
        method: 'POST',
        headers: { 'Content-Type': type },
        body: v,
      });
    await expect(body(req('{"id":"x"}'), schema)).resolves.toEqual({ id: 'x' });
    await expect(body(req('bad'), schema)).rejects.toThrow();
    await expect(body(req('{"id":"x","amount":"999"}'), schema)).rejects.toThrow();
    await expect(body(req('123456'), schema, 5)).rejects.toThrow('Body too large');
    await expect(body(req('{}', 'text/plain'), schema)).rejects.toThrow(
      'application/json',
    );
  });
  it('serializes bigint and redacts internal errors', async () => {
    const ok = await envelope(async () => ({ amount: 10n ** 37n }));
    const value = await ok.json();
    expect(value.data.amount).toBe((10n ** 37n).toString());
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const err = await envelope(async () => {
      throw Error('private-key-secret');
    });
    expect(err.status).toBe(500);
    expect(JSON.stringify(await err.json())).not.toContain('private-key-secret');
  });
});

it('owner and allocation authorization return 403 without private claim data', async () => {
  const p = { authUserId: 'a', githubUserId: '123' };
  const program = { owner_auth_user_id: 'a', owner_github_id: '123' };
  expect(() => authorizeOwner(program, p)).not.toThrow();
  for (const other of [
    { authUserId: 'b', githubUserId: '123' },
    { authUserId: 'a', githubUserId: '999' },
  ]) {
    const r = await envelope(async () => {
      authorizeOwner(program, other);
      return { privateClaim: 'secret' };
    });
    expect(r.status).toBe(403);
    expect(JSON.stringify(await r.json())).not.toContain('privateClaim');
  }
});
