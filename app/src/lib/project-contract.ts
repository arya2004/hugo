import { parseAbi, keccak256, stringToHex } from 'viem';

export const projectAbi = parseAbi([
  'constructor(address token,bytes32 repo,address signer,uint256 maximum)',
  'function usdc() view returns(address)',
  'function administrator() view returns(address)',
  'function repositoryKey() view returns(bytes32)',
  'function rewardSigner() view returns(address)',
  'function maxRewardMicro() view returns(uint256)',
  'function available() view returns(uint256)',
  'function reserved() view returns(uint256)',
  'function rewards(bytes32) view returns(uint256 amount,uint256 remaining,bytes32 reportHash,uint64 mergedAt)',
  'function claimUsed(bytes32) view returns(bool)',
  'function allocations(bytes32) view returns(bytes32 mergeId,uint256 amount)',
  'function fundingActive() view returns(bool)',
  'function fundingAt(uint64) view returns(bool)',
  'function setFundingActive(bool active)',
  'function fund(uint256 amount)',
  'function reserveReward(bytes32 mergeId,uint64 mergedAt,bytes32 reportHash,bytes32[] claimIds,uint256[] amounts)',
  'function claim((bytes32 mergeId,bytes32 claimId,bytes32 reportHash,address recipient,uint256 amount,uint64 deadline) c,bytes signature)',
  'event ProjectFunded(address indexed donor,uint256 amount)',
  'event FundingStateChanged(bool active,uint64 effectiveAt)',
  'event RewardReserved(bytes32 indexed mergeId,uint256 amount,bytes32 reportHash)',
  'event RewardClaimed(bytes32 indexed mergeId,bytes32 indexed claimId,address recipient,uint256 amount)',
]);

export const repositoryKey = (githubRepoId: string) =>
  keccak256(stringToHex(`github:repository:${githubRepoId}`));

export const projectClaimTypes = {
  Claim: [
    { name: 'mergeId', type: 'bytes32' },
    { name: 'claimId', type: 'bytes32' },
    { name: 'reportHash', type: 'bytes32' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;
