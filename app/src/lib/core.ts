import { z } from 'zod';
import { canonicalize } from 'json-canonicalize';
import { keccak256, stringToHex, type Address, type Hex } from 'viem';

export const address = z
  .string()
  .regex(/^0x[\da-fA-F]{40}$/)
  .transform((v) => v.toLowerCase() as Address);

export const bytes32 = z
  .string()
  .regex(/^0x[\da-fA-F]{64}$/)
  .transform((v) => v.toLowerCase() as Hex);

export const numericId = z.string().regex(/^[1-9]\d{0,19}$/);

export const sha = z.string().regex(/^[a-f0-9]{40,64}$/);

export const fullName = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);

export const hash = (value: unknown): Hex => keccak256(stringToHex(canonicalize(value)));

export function allocate(budget: bigint, scores: { identity: string; score: bigint }[]) {
  if (
    budget < 0n ||
    scores.some((s) => s.score < 0n) ||
    new Set(scores.map((s) => s.identity)).size !== scores.length
  ) {
    throw Error('Invalid allocation');
  }
  const rows = scores
    .filter((s) => s.score > 0n)
    .sort((a, b) => (a.identity < b.identity ? -1 : 1));
  const total = rows.reduce((n, s) => n + s.score, 0n);
  if (!total || !budget) {
    return [];
  }
  const out = rows.map((s) => ({
    ...s,
    amount: (budget * s.score) / total,
    residue: (budget * s.score) % total,
  }));
  let remainder = budget - out.reduce((n, r) => n + r.amount, 0n);
  const order = [...out].sort((a, b) =>
    a.residue === b.residue
      ? a.identity < b.identity
        ? -1
        : 1
      : a.residue > b.residue
        ? -1
        : 1,
  );
  for (let i = 0; remainder > 0n; i++, remainder--) {
    order[i].amount++;
  }
  return out
    .filter((r) => r.amount > 0n)
    .map(({ identity, score, amount }) => ({ identity, score, amount }));
}

export const scoreSchema = z
  .object({
    provider: z.literal('github'),
    providerUserId: numericId,
    role: z.enum(['CONTRIBUTOR', 'REVIEWER_ONLY']),
    impactScore: z.number().int().min(0).max(100),
    evidenceKeys: z.array(z.string().max(180)).min(1).max(20),
    justification: z.string().min(10).max(800),
  })
  .strict();

export const modelOutput = z
  .object({ scores: z.array(scoreSchema).min(1).max(30) })
  .strict();

export type Roster = { providerUserId: string; role: 'CONTRIBUTOR' | 'REVIEWER_ONLY' }[];

export function validateScores(input: unknown, roster: Roster, keys: string[]) {
  const out = modelOutput.parse(input);
  const seen = new Set<string>();
  for (const s of out.scores) {
    const known = roster.find((r) => r.providerUserId === s.providerUserId);
    if (
      !known ||
      known.role !== s.role ||
      seen.has(s.providerUserId) ||
      s.evidenceKeys.some((k) => !keys.includes(k)) ||
      (s.role === 'REVIEWER_ONLY' && s.impactScore !== 0)
    ) {
      throw Error('Invalid evaluation evidence');
    }
    seen.add(s.providerUserId);
  }
  if (roster.some((r) => !seen.has(r.providerUserId))) {
    throw Error('Incomplete identity evaluation');
  }
  return out.scores;
}

export function githubIdentity(
  user: {
    id: string;
    identities?: { provider: string; provider_id?: string; user_id?: string }[];
  },
  sub: string,
) {
  if (user.id !== sub) {
    throw Error('Principal mismatch');
  }
  const ids = user.identities?.filter(
    (i) =>
      i.provider === 'github' &&
      i.user_id === sub &&
      numericId.safeParse(i.provider_id).success,
  );
  if (ids?.length !== 1) {
    throw Error('Verified GitHub identity required');
  }
  return { authUserId: sub, githubUserId: ids[0].provider_id! };
}
