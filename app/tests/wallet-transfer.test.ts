import { expect, it } from 'vitest';
import { zeroAddress } from 'viem';
import { withdrawAll } from '../src/lib/wallet-transfer';

const destination = `0x${'12'.repeat(20)}`;

it('withdraws the entire spendable balance after the fee without losing precision', () => {
  const balance = 1000000000000000001n;
  const fee = 1000000000000000n;
  expect(withdrawAll(destination, balance, fee).value + fee).toBe(balance);
});

it('rejects invalid destinations and zero address', () => {
  for (const to of ['not-a-wallet', zeroAddress]) {
    expect(() => withdrawAll(to, 100n, 1n)).toThrow();
  }
});

it('does not create a withdrawal when fees consume the balance', () => {
  expect(() => withdrawAll(destination, 10n, 10n)).toThrow();
  expect(() => withdrawAll(destination, 0n, 1n)).toThrow();
});
