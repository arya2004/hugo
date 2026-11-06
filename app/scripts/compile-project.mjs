// Generates the actual deployment artifact used by repository registration. No tests or network calls.
import fs from 'node:fs';
import solc from 'solc';

const source = fs.readFileSync('contracts/ContributionTreasury.sol', 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'ContributionTreasury.sol': { content: source } },
  settings: {
    evmVersion: 'shanghai',
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
const output = JSON.parse(
  solc.compile(JSON.stringify(input), {
    import: (path) => ({ contents: fs.readFileSync(`node_modules/${path}`, 'utf8') }),
  }),
);
const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
if (errors.length) {
  throw Error(errors.map((e) => e.formattedMessage).join('\n'));
}
const contract = output.contracts['ContributionTreasury.sol'].ContributionTreasury;
fs.mkdirSync('src/lib/generated', { recursive: true });
fs.writeFileSync(
  'src/lib/generated/project-treasury.json',
  JSON.stringify(
    {
      compiler: solc.version(),
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Generated per-project treasury deployment artifact. No deployment performed.',
);
