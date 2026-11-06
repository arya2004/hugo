import 'server-only';
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
} from '@arkiv-network/sdk';
import { defineSchema, str } from '@arkiv-network/sdk/schema';
import { eq } from '@arkiv-network/sdk/query';
import { rabdi } from '@arkiv-network/sdk/chains';
import { http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { address } from '../lib/core';
import { required } from './env';

// No claimant IDs, embedded-wallet mappings, individual amounts or raw evaluations.
const Attestations = defineSchema('poc.v2.attestation', {
  project: str().indexed(),
  kind: str().indexed(),
  subject: str().indexed(),
  revision: str(),
  programId: str(),
  name: str(),
  treasury: str(),
  mergeSha: str(),
  evidenceHash: str(),
  eligibility: str(),
  settlement: str(),
  reference: str(),
});

function chain() {
  return rabdi({ accessKey: required('ARKIV_ACCESS_KEY') });
}

async function records(kind: string) {
  const client = createPublicClient({
    chain: chain(),
    transport: http(undefined, { timeout: 15000, retryCount: 1 }),
  });
  const { entities } = await client
    .select()
    .from(Attestations)
    .ownedBy(address.parse(required('ARKIV_ISSUER_ADDRESS')))
    .where(eq('project', 'proof-of-contribution'), eq('kind', kind))
    .limit(50)
    .fetch();
  const latest = new Map<string, Record<string, string>>();
  for (const entity of entities) {
    const record = Object.fromEntries(
      Object.entries(entity)
        .filter(([key]) => key !== '$key')
        .map(([key, value]) => [key, (value as { value: string }).value]),
    );
    const old = latest.get(record.subject);
    if (!old || BigInt(record.revision) > BigInt(old.revision)) {
      latest.set(record.subject, { ...record, entityKey: entity.$key });
    }
  }
  return [...latest.values()];
}

export const arkivPrograms = () => records('Program');

export const arkivContributions = () => records('Contribution');

export async function publishAttestation(data: {
  kind: string;
  subject: string;
  revision: string;
  programId: string;
  name: string;
  treasury: string;
  mergeSha: string;
  evidenceHash: string;
  eligibility: string;
  settlement: string;
  reference: string;
}) {
  const account = privateKeyToAccount(required('ARKIV_WRITER_PRIVATE_KEY') as Hex);
  if (account.address.toLowerCase() !== required('ARKIV_ISSUER_ADDRESS').toLowerCase()) {
    throw Error('Arkiv issuer mismatch');
  }
  const writer = createWalletClient({ chain: chain(), transport: http(), account });
  return writer.createEntity(
    Attestations,
    { project: 'proof-of-contribution', ...data },
    { expiration: ExpirationTime.fromDays(90) },
  );
}
