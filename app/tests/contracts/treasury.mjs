import fs from 'node:fs';
import assert from 'node:assert/strict';
import solc from 'solc';
import hre from 'hardhat';
import {
  createPublicClient,
  createWalletClient,
  custom,
  keccak256,
  stringToHex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const sources = Object.fromEntries(
  ['ContributionTreasury.sol', 'TestToken.sol'].map((file) => [
    file,
    { content: fs.readFileSync(`contracts/${file}`, 'utf8') },
  ]),
);
const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: 'Solidity',
      sources,
      settings: {
        evmVersion: 'shanghai',
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
      },
    }),
    { import: (path) => ({ contents: fs.readFileSync(`node_modules/${path}`, 'utf8') }) },
  ),
);
for (const error of output.errors ?? []) {
  if (error.severity === 'error') {
    throw Error(error.formattedMessage);
  }
}
const connection = await hre.network.create('localArc');
try {
  const accounts = Array.from({ length: 5 }, () =>
    privateKeyToAccount(generatePrivateKey()),
  );
  for (const account of accounts) {
    await connection.provider.request({
      method: 'hardhat_setBalance',
      params: [account.address, '0x3635C9ADC5DEA00000'],
    });
  }
  const chain = {
    id: 5042002,
    name: 'Arc local test',
    nativeCurrency: { name: 'test', symbol: 'TEST', decimals: 18 },
    rpcUrls: { default: { http: ['http://unused'] } },
  };
  const client = createPublicClient({ chain, transport: custom(connection.provider) });
  const writers = accounts.map((account) =>
    createWalletClient({ chain, account, transport: custom(connection.provider) }),
  );
  const receipt = async (hash) => {
    const r = await client.waitForTransactionReceipt({ hash });
    assert.equal(r.status, 'success');
    return r;
  };

  async function deploy(file, name, args) {
    const contract = output.contracts[file][name];
    const r = await receipt(
      await writers[0].deployContract({
        abi: contract.abi,
        bytecode: `0x${contract.evm.bytecode.object}`,
        args,
      }),
    );
    return { address: r.contractAddress, abi: contract.abi };
  }
  const token = await deploy('TestToken.sol', 'TestToken', []);
  const key = (text) => keccak256(stringToHex(text));
  const vault = await deploy('ContributionTreasury.sol', 'ContributionTreasury', [
    token.address,
    key('repo'),
    accounts[1].address,
    100n,
  ]);
  const write = async (contract, functionName, args, sender = 0) =>
    receipt(await writers[sender].writeContract({ ...contract, functionName, args }));
  const read = (functionName, args = []) =>
    client.readContract({ ...vault, functionName, args });
  for (const index of [0, 2]) {
    await write(token, 'mint', [accounts[index].address, 200n]);
    await write(token, 'approve', [vault.address, 200n], index);
    await write(vault, 'fund', [200n], index);
  }
  assert.equal(await read('available'), 400n);
  console.log('PASS owner and public donations; initial funding stopped');
  assert.equal(await read('fundingActive'), false);
  await assert.rejects(() => write(vault, 'setFundingActive', [true], 2));
  await write(vault, 'setFundingActive', [true]);
  const mergeTime = (await client.getBlock()).timestamp;
  await write(vault, 'setFundingActive', [false]);
  const stoppedTime = (await client.getBlock()).timestamp;
  const ids = [key('contributor1'), key('contributor2')];
  const report = key('report');
  await assert.rejects(() =>
    write(
      vault,
      'reserveReward',
      [key('overcap'), mergeTime, report, ids, [81n, 20n]],
      1,
    ),
  );
  await write(
    vault,
    'reserveReward',
    [key('merge'), mergeTime, report, ids, [80n, 20n]],
    1,
  );
  assert.equal(await read('reserved'), 100n);
  await assert.rejects(() =>
    write(
      vault,
      'reserveReward',
      [key('merge'), mergeTime, report, [key('duplicate')], [1n]],
      1,
    ),
  );
  console.log(
    'PASS immutable combined PR cap and one reservation; active merge remains eligible after stop',
  );
  await write(vault, 'setFundingActive', [true]);
  await assert.rejects(() =>
    write(
      vault,
      'reserveReward',
      [key('stopped'), stoppedTime, report, [key('stopped-person')], [1n]],
      1,
    ),
  );
  const types = {
    Claim: [
      { name: 'mergeId', type: 'bytes32' },
      { name: 'claimId', type: 'bytes32' },
      { name: 'reportHash', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
    ],
  };

  async function claim(index, amount) {
    const message = {
      mergeId: key('merge'),
      claimId: ids[index],
      reportHash: report,
      recipient: accounts[index + 3].address,
      amount,
      deadline: (await client.getBlock()).timestamp + 3600n,
    };
    const signature = await accounts[1].signTypedData({
      domain: {
        name: 'ProofOfContribution',
        version: '2',
        chainId: 5042002,
        verifyingContract: vault.address,
      },
      types,
      primaryType: 'Claim',
      message,
    });
    await write(vault, 'claim', [message, signature], 2);
    await assert.rejects(() => write(vault, 'claim', [message, signature], 2));
  }
  await claim(0, 80n);
  assert.equal(await read('reserved'), 20n);
  await write(vault, 'setFundingActive', [false]);
  await claim(1, 20n);
  assert.equal(await read('reserved'), 0n);
  assert.equal(await read('available'), 300n);
  console.log(
    'PASS independent immediate/later recipient payments, stop preserves claims, at-most-once and solvency',
  );
  console.log('PASS local EVM only; no Arc deployment or thirdweb login claimed.');
} finally {
  await connection.close();
}
