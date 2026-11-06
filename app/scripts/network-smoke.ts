import assert from 'node:assert/strict';
import { createPublicClient, http, erc20Abi } from 'viem';
import { arcTestnet } from 'viem/chains';
import { USDC } from '../src/lib/contracts';
import { github } from '../src/server/github';

const arc = createPublicClient({
  chain: arcTestnet,
  transport: http('https://rpc.testnet.arc.io', { timeout: 20000, retryCount: 1 }),
});
assert.equal(await arc.getChainId(), 5042002);
console.log('PASS live Arc eth_chainId=5042002');
assert.equal(
  await arc.readContract({ address: USDC, abi: erc20Abi, functionName: 'decimals' }),
  6,
);
console.log('PASS live Arc USDC ERC20 decimals=6; no transfers performed');
const repo = await (await github('/repos/smartcontractkit/cre-templates')).json();
assert.ok(Number.isSafeInteger(repo.id) && !repo.private);
console.log(
  `PASS live GitHub REST immutable public repo ID=${repo.id} full_name=${repo.full_name}`,
);
console.log(
  'No deployment, inference, entity write, claim or CRE simulation was performed.',
);
