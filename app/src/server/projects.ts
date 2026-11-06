import 'server-only';
import { randomUUID } from 'node:crypto';
import { concatHex, encodeAbiParameters, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bytes32, fullName } from '../lib/core';
import { repositoryKey } from '../lib/project-contract';
import { USDC } from '../lib/contracts';
import artifact from '../lib/generated/project-treasury.json';
import { db, one, query, rpc } from './db';
import { AppError, required } from './env';
import { arc } from './arc';
import { projectState } from './project-chain';
import { linked } from './auth';

type Principal = { authUserId: string; githubUserId: string };

// POC: the signed-in registrant is assumed to own the repository.
async function repositoryMetadata(repository: string) {
  fullName.parse(repository);
  const response = await fetch(`https://api.github.com/repos/${repository}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Hugo' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new AppError(
      422,
      'REPOSITORY_UNAVAILABLE',
      'Enter an accessible public GitHub repository',
    );
  }
  return response.json();
}

function signer() {
  return privateKeyToAccount(
    bytes32.parse(required('PAYOUT_VOUCHER_SIGNER_KEY')),
  ).address.toLowerCase();
}

export async function prepareProject(repository: string, maxRewardMicro: string) {
  const repo = await repositoryMetadata(repository);
  const existing = await query(
    db()
      .from('repositories')
      .select('id')
      .eq('provider', 'github')
      .eq('external_repo_id', String(repo.id))
      .maybeSingle(),
  );
  if (existing) {
    throw new AppError(409, 'PROJECT_EXISTS', 'This repository is already registered');
  }
  return {
    id: randomUUID(),
    repository: repo.full_name,
    repositoryKey: repositoryKey(String(repo.id)),
    voucherSigner: signer(),
    maxRewardMicro,
    chainId: 5042002,
  };
}

export async function projectDetail(project: any) {
  const repo = await query<any>(
    db().from('repositories').select('full_name').eq('program_id', project.id).single(),
  );
  const state = await projectState(project.treasury_address);
  return {
    id: project.id,
    repoFullName: repo.full_name,
    name: project.name,
    description: project.description,
    fundingAddress: project.treasury_address,
    deploymentTxHash: project.deployment_tx_hash,
    ownerWallet: project.owner_wallet,
    repositoryKey: state.repositoryKey,
    maxRewardMicro: state.maximum.toString(),
    availableMicro: state.available.toString(),
    reservedMicro: state.reserved.toString(),
    fundingActive: state.active,
    contractVersion: project.contract_version,
  };
}

export async function registerProject(
  input: {
    id: string;
    repository: string;
    ownerWallet: string;
    treasuryAddress: string;
    deploymentTxHash: Hex;
    maxRewardMicro: string;
  },
  principal: Principal,
) {
  const repo = await repositoryMetadata(input.repository);
  await linked(principal.authUserId, input.ownerWallet);
  const client = arc();
  if ((await client.getChainId()) !== 5042002) {
    throw new AppError(503, 'WRONG_CHAIN', 'Arc Testnet required');
  }
  const receipt = await client.getTransactionReceipt({ hash: input.deploymentTxHash });
  const head = await client.getBlockNumber();
  if (receipt.status !== 'success' || head < receipt.blockNumber + 2n) {
    throw new AppError(
      409,
      'DEPLOYMENT_PENDING',
      'Waiting for the funding address to be confirmed',
    );
  }
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const tx = await client.getTransaction({ hash: input.deploymentTxHash });
  const key = repositoryKey(String(repo.id));
  const rewardSigner = signer();
  const expected = concatHex([
    artifact.bytecode as Hex,
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'uint256' },
      ],
      [USDC, key, rewardSigner as Hex, BigInt(input.maxRewardMicro)],
    ),
  ]);
  if (
    block.hash !== receipt.blockHash ||
    receipt.contractAddress?.toLowerCase() !== input.treasuryAddress ||
    receipt.from.toLowerCase() !== input.ownerWallet ||
    tx.to !== null ||
    tx.input.toLowerCase() !== expected.toLowerCase() ||
    tx.value !== 0n
  ) {
    throw new AppError(
      422,
      'DEPLOYMENT_MISMATCH',
      'Funding address must be the treasury created by your admin wallet for this repository',
    );
  }
  const state = await projectState(input.treasuryAddress);
  if (
    state.admin !== input.ownerWallet ||
    state.repositoryKey !== key ||
    state.signer !== rewardSigner ||
    state.maximum !== BigInt(input.maxRewardMicro)
  ) {
    throw new AppError(
      422,
      'PROJECT_MISMATCH',
      'Project configuration does not match the registered repository',
    );
  }
  await rpc('register_project', {
    p_id: input.id,
    p_chain_id: key,
    p_name: repo.name,
    p_description: (repo.description ?? '').slice(0, 3000),
    p_actor: principal.authUserId,
    p_github_id: principal.githubUserId,
    p_wallet: input.ownerWallet,
    p_signer: rewardSigner,
    p_treasury: input.treasuryAddress,
    p_deployment_tx: input.deploymentTxHash,
    p_create_tx: input.deploymentTxHash,
    p_repo_id: String(repo.id),
    p_repo_name: repo.full_name,
    p_branch: repo.default_branch,
  });
  await query(
    db()
      .from('programs')
      .update({ max_reward_micro: input.maxRewardMicro, contract_version: 2 })
      .eq('id', input.id),
  );
  return projectDetail(await one('programs', input.id));
}
