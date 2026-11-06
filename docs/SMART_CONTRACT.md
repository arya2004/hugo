# Arc Testnet smart contract and voucher signing specification

## Manual prerequisite: Arc Studio

Before coding, open https://studio.arc.io and create an Arc project with the prompt: "A programmable USDC treasury for donor/DAO-funded open-source development programs. Multiple wallets fund program treasuries; operator reserves weekly reward budgets; independent contributors claim via signed EIP-712 vouchers; payouts have unique claim IDs, expiry and replay protection. Build smart contract, UI and tests for Arc Testnet." Keep the shareable project link. Use Studio to implement/test the contract; reconcile its output with the reference `contracts/ContributionTreasury.sol` and the immutable requirements below. **Don't claim eligibility without Studio evidence.**

## Exact networks and units

- Arc Testnet chain ID **5042002**, RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`.
- USDC ERC-20 interface **`0x3600000000000000000000000000000000000000`**, **6 token decimals**. Arc native gas is denominated USDC at 18 gas precision. Do not mix native `value` / gas units and ERC20 micro-USDC.
- Faucet https://faucet.circle.com (select Arc Testnet). Verify both wallet native-gas ability and token contract approval/transferFrom behavior on testnet before deploying full app.
- `viem/chains` exports `arcTestnet` in current viem versions.

## Reference contract

`../contracts/ContributionTreasury.sol` is a concrete code reference. Dependencies: Solidity `^0.8.26`, recent `@openzeppelin/contracts` v5. Compile with Foundry or Hardhat and run tests. Deploy constructor argument: `0x3600000000000000000000000000000000000000`. Pin compile/deploy versions.

### Proven accounting

`program.available` moves up on `fund()`, down on `reserveEpoch()`, up on `closeEpoch()` after expiry. `program.reserved` moves up on reserve, down on claim or expired close. Claim always transfers USDC to signed recipient. No owner withdrawal in MVP; unallocated funds remain in the treasury. **This is testnet-only; do not send real mainnet money.**

### ID derivation

- `programId`: `keccak256(utf8("poc:program:" + dbProgramUuid))`; prepare client-side before `createProgram`, and persist only after receipt. If DB UUID created beforehand, store draft until onchain success.
- `epochId`: `keccak256(abi.encode(programId, periodIndex))` with ABI encode (not `encodePacked`); persist deterministic ID.
- `reportHash`: `keccak256` of a canonical JSON report (RFC 8785/JCS canonicalization preferred, or deterministic sorted-key encoding with tests). Report contains program ID, epoch ID, exact source merge SHAs, contribution scores, algorithm version, micro-USDC budget and per-account allocations. A change to an approved report invalidates previous hash.
- `claimId`: cryptographically random 32 bytes per recipient allocation. Do NOT derive from public GitHub ID, which leaks identity. Persist offchain; onchain ID becomes visible upon claim.

### EIP712 schema (MUST match contract exactly)

Domain: `name="ProofOfContribution"`, `version="1"`, `chainId=5042002`, `verifyingContract=deployedVaultAddress`.

```
Claim(bytes32 epochId,bytes32 claimId,bytes32 reportHash,address recipient,uint256 amount,uint64 deadline)
```

TypeScript `viem` sketch (server only; all numeric input strings validated):

```ts
const domain = {
  name: 'ProofOfContribution',
  version: '1',
  chainId: 5042002,
  verifyingContract: treasuryAddress,
} as const;
const types = {
  Claim: [
    { name: 'epochId', type: 'bytes32' },
    { name: 'claimId', type: 'bytes32' },
    { name: 'reportHash', type: 'bytes32' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;
const signature = await privateKeyToAccount(voucherSignerKey).signTypedData({
  domain, types, primaryType: 'Claim',
  message: {
    epochId, claimId, reportHash, recipient,
    amount: BigInt(amountMicroString), deadline: BigInt(unixSeconds),
  },
});
```

**Important:** In the JS client `deadline` as BigInt is fine; in Solidity `uint64`. Require `deadline <= epoch.expiresAt` at voucher issuance so it does not outlive the epoch. Voucher signing happens only after verified authenticated forge account + wallet signature and only against a confirmed `RESERVED` period. Never sign arbitrary amount supplied by browser.

### Owner authorization

`reserveEpoch` must be an onchain transaction from the real program owner wallet; the API may prepare unsigned tx data but cannot impersonate owner. The voucher signing key is a **separate testnet key** authorized in `createProgram`. A backend signing key compromise can drain reserved epochs (up to those caps); use no mainnet assets and rotate immediately if exposed.

### Tests / edge cases

See `ACCEPTANCE.md`; add a malicious ERC20 reentrancy simulation, wrong signer / program, owner rotation, replay from another chain or vault, multiple concurrent claims and expired closure. If a USDC blacklisting/token transfer failure reverts, the claim must not be marked consumed because EVM reverts atomically.
