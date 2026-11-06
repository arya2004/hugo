import 'server-only';
import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';
import { address } from '../lib/core';
import { required } from './env';

export function arc() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.io', {
      timeout: 15000,
      retryCount: 1,
    }),
  });
}

export function treasury(contract?: string) {
  return address.parse(contract ?? required('NEXT_PUBLIC_TREASURY_ADDRESS'));
}
