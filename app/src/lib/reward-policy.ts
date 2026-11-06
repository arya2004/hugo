import { allocate } from './core';

export type ContributorScore = {
  identity_provider: string;
  provider_user_id: string;
  contribution_role: string;
  impact_score: number;
};

// Versioned, integer-only policy: 80% of the trailing seven-day inflow / seven,
// scaled by the highest eligible quality score. The cap covers ALL recipients.
export function mergeBudget(
  cap: bigint,
  available: bigint,
  inflow: bigint,
  scores: ContributorScore[],
) {
  if (cap < 0n || available < 0n || inflow < 0n) {
    throw Error('Negative funding');
  }
  const contributors = scores.filter(
    (s) => s.contribution_role === 'CONTRIBUTOR' && s.impact_score > 0,
  );
  const quality = BigInt(Math.max(0, ...contributors.map((s) => s.impact_score)));
  if (quality > 100n) {
    throw Error('Invalid quality');
  }
  const daily = (inflow * 8000n) / 70000n;
  const target = ((daily < cap ? daily : cap) * quality) / 100n;
  const budget = target < available ? target : available;
  return {
    budget,
    shares: allocate(
      budget,
      contributors.map((s) => ({
        identity: `${s.identity_provider}:${s.provider_user_id}`,
        score: BigInt(s.impact_score),
      })),
    ),
  };
}

export function fundingAt(
  transitions: { timestamp: number; active: boolean; order: number }[],
  mergedAt: number,
) {
  return (
    [...transitions]
      .filter((t) => t.timestamp <= mergedAt)
      .sort((a, b) => b.timestamp - a.timestamp || b.order - a.order)[0]?.active ?? false
  );
}

export function verifiedGithubWallet(
  user: {
    userId: string;
    walletAddress: string;
    profiles: { type: string; details: { id?: string } }[];
  } | null,
  wallet: string,
) {
  const profiles = user?.profiles.filter((p) => p.type === 'github') ?? [];
  if (
    !user ||
    user.walletAddress.toLowerCase() !== wallet.toLowerCase() ||
    profiles.length !== 1 ||
    !/^[1-9]\d{0,19}$/.test(profiles[0].details.id ?? '')
  ) {
    throw Error('Verified numeric GitHub identity and embedded wallet required');
  }
  return {
    provider: 'github',
    providerUserId: profiles[0].details.id!,
    wallet: wallet.toLowerCase(),
    thirdwebUserId: user.userId,
  };
}
