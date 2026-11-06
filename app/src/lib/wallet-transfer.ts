import { getAddress, isAddress, zeroAddress } from 'viem';

export function withdrawAll(to: string, balance: bigint, networkFee: bigint) {
  if (!isAddress(to) || to.toLowerCase() === zeroAddress) {
    throw Error('Enter a valid Arc wallet address');
  }
  if (networkFee < 0n || balance <= networkFee) {
    throw Error('Your balance is too low to cover the network fee');
  }
  return { to: getAddress(to), value: balance - networkFee };
}
