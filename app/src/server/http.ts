import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError, appOrigin, secret } from './env';

export function bearer(req: Request, name: string) {
  const expected = secret(name);
  const got = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const digest = (v: string) => createHash('sha256').update(v).digest();
  if (!timingSafeEqual(digest(expected), digest(got))) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid integration token');
  }
}

export async function body<T extends z.ZodType>(
  req: Request,
  schema: T,
  limit = 65536,
): Promise<z.infer<T>> {
  if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    throw new AppError(400, 'JSON_REQUIRED', 'Use application/json');
  }
  if (Number(req.headers.get('content-length') ?? 0) > limit) {
    throw new AppError(413, 'BODY_TOO_LARGE', 'Body too large');
  }
  const reader = req.body?.getReader();
  if (!reader) {
    throw new AppError(400, 'INVALID_JSON', 'JSON body required');
  }
  let count = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const r = await reader.read();
    if (r.done) {
      break;
    }
    count += r.value.byteLength;
    if (count > limit) {
      await reader.cancel();
      throw new AppError(413, 'BODY_TOO_LARGE', 'Body too large');
    }
    chunks.push(r.value);
  }
  try {
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    throw new AppError(400, 'INVALID_BODY', 'Invalid JSON schema');
  }
}

export function sameOrigin(req: Request) {
  if (req.headers.get('origin') !== appOrigin()) {
    throw new AppError(403, 'ORIGIN_REJECTED', 'Same-origin request required');
  }
}

export async function envelope(work: () => Promise<unknown>) {
  const requestId = randomUUID();
  const headers = { 'Cache-Control': 'no-store', 'X-Request-ID': requestId };
  try {
    const data = await work();
    return new Response(
      JSON.stringify({ data, requestId }, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
      { headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const a =
      e instanceof AppError
        ? e
        : e instanceof z.ZodError
          ? new AppError(400, 'INVALID_INPUT', 'Invalid request input')
          : new AppError(500, 'INTERNAL_ERROR', 'Request failed');
    return Response.json(
      { error: { code: a.code, message: a.message }, requestId },
      { status: a.status, headers },
    );
  }
}
