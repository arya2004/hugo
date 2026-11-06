import { expect, it } from 'vitest';
import { mergeBudget, fundingAt, verifiedGithubWallet } from '../src/lib/reward-policy';

const scores = [
  {
    identity_provider: 'github',
    provider_user_id: '101',
    contribution_role: 'CONTRIBUTOR',
    impact_score: 80,
  },
  {
    identity_provider: 'github',
    provider_user_id: '202',
    contribution_role: 'CONTRIBUTOR',
    impact_score: 20,
  },
  {
    identity_provider: 'github',
    provider_user_id: '303',
    contribution_role: 'REVIEWER_ONLY',
    impact_score: 0,
  },
];
it('splits a donation-aware, capped, funded PR reward across code contributors only', () => {
  const reward = mergeBudget(100000000n, 100000000n, 700000000n, scores);
  expect(reward.budget).toBe(64000000n);
  expect(reward.shares.map((s) => s.amount)).toEqual([51200000n, 12800000n]);
  expect(mergeBudget(100000000n, 100000000n, 350000000n, scores).budget).toBe(32000000n);
  expect(mergeBudget(100000000n, 0n, 700000000n, scores).shares).toEqual([]);
});
it('uses merge time across stop/restart regardless of delivery order', () => {
  const transitions = [
    { timestamp: 30, active: true, order: 3 },
    { timestamp: 10, active: true, order: 1 },
    { timestamp: 20, active: false, order: 2 },
  ];
  expect(fundingAt(transitions, 15)).toBe(true);
  expect(fundingAt(transitions, 25)).toBe(false);
  expect(fundingAt(transitions, 35)).toBe(true);
});
it('requires a server-verified GitHub numeric ID and matching embedded wallet', () => {
  const wallet = `0x${'11'.repeat(20)}`;
  const user = {
    userId: 'thirdweb-user',
    walletAddress: wallet,
    profiles: [{ type: 'github', details: { id: '101' } }],
  };
  expect(verifiedGithubWallet(user, wallet).providerUserId).toBe('101');
  expect(() => verifiedGithubWallet(user, `0x${'22'.repeat(20)}`)).toThrow();
  expect(() =>
    verifiedGithubWallet(
      { ...user, profiles: [{ type: 'github', details: { id: 'username' } }] },
      wallet,
    ),
  ).toThrow();
});
