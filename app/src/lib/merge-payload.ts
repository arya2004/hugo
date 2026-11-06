import { z } from 'zod';
import { fullName, numericId, sha } from './core';

// POC trust boundary: the authenticated workflow supplies all merge evidence.
export const mergePayload = z.object({
  provider: z.literal('github'),
  repository: fullName,
  repositoryId: numericId,
  prNumber: z.number().int().positive(),
  mergeSha: sha,
  mergedAt: z.iso.datetime(),
  roster: z
    .array(
      z.object({
        providerUserId: numericId,
        role: z.enum(['CONTRIBUTOR', 'REVIEWER_ONLY']),
      }),
    )
    .min(1)
    .max(30),
  sources: z.array(z.object({ key: z.string().min(1), data: z.unknown() })).min(1),
});

export type MergePayload = z.infer<typeof mergePayload>;
