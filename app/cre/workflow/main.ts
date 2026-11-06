import {
  cre,
  Runner,
  getNetwork,
  encodeCallMsg,
  LAST_FINALIZED_BLOCK_NUMBER,
  consensusIdenticalAggregation,
  text,
  type Runtime,
  type HTTPSendRequester,
} from '@chainlink/cre-sdk';
import {
  parseAbi,
  encodeFunctionData,
  decodeFunctionResult,
  bytesToHex,
  type Address,
  type Hex,
} from 'viem';
import { z } from 'zod';
const configSchema = z.object({
  schedule: z.string(),
  reportUrl: z.url(),
  expectedOrigin: z.url(),
  treasuryAddress: z.string().regex(/^0x[\da-fA-F]{40}$/),
});
type Config = z.infer<typeof configSchema>;
const reportSchema = z.object({
  chainId: z.literal(5042002),
  treasuryAddress: z.string(),
  repositoryKey: z.string(),
  mergeId: z.string(),
  reportHash: z.string(),
  amountMicro: z.string().regex(/^\d+$/),
  maxRewardMicro: z.string().regex(/^\d+$/),
  mergedAt: z.string().regex(/^\d+$/),
  eligible: z.literal(true),
});
const abi = parseAbi([
  'function repositoryKey() view returns(bytes32)',
  'function rewards(bytes32) view returns(uint256 amount,uint256 remaining,bytes32 reportHash,uint64 mergedAt)',
  'function maxRewardMicro() view returns(uint256)',
  'function fundingAt(uint64) view returns(bool)',
]);
function fetchReport(sender: HTTPSendRequester, config: Config, token: string): string {
  const url = new URL(config.reportUrl);
  if (url.protocol !== 'https:' || url.origin !== config.expectedOrigin || url.search)
    throw Error('Expected HTTPS origin required');
  const response = sender
    .sendRequest({
      url: url.href,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cacheSettings: { store: true, maxAge: '30s' },
    })
    .result();
  if (response.statusCode !== 200) throw Error('Report unavailable');
  const body = text(response);
  if (body.length > 65536) throw Error('Report too large');
  return JSON.stringify(reportSchema.parse(JSON.parse(body).data));
}
function onCron(runtime: Runtime<Config>): string {
  const token = runtime.getSecret({ id: 'CRE_EXTERNAL_REPORT_TOKEN' }).result().value;
  const http = new cre.capabilities.HTTPClient();
  const report = reportSchema.parse(
    JSON.parse(
      http
        .sendRequest(
          runtime,
          fetchReport,
          consensusIdenticalAggregation<string>(),
        )(runtime.config, token)
        .result(),
    ),
  );
  if (
    report.treasuryAddress.toLowerCase() !== runtime.config.treasuryAddress.toLowerCase()
  )
    throw Error('Project mismatch');
  const network = getNetwork({
    chainFamily: 'evm',
    chainSelectorName: 'arc-testnet',
    isTestnet: true,
  });
  if (!network) throw Error('Arc selector unavailable');
  const evm = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const call = (data: Hex) =>
    bytesToHex(
      evm
        .callContract(runtime, {
          call: encodeCallMsg({
            from: '0x0000000000000000000000000000000000000000',
            to: runtime.config.treasuryAddress as Address,
            data,
          }),
          blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
        })
        .result().data,
    );
  const repo = decodeFunctionResult({
    abi,
    functionName: 'repositoryKey',
    data: call(encodeFunctionData({ abi, functionName: 'repositoryKey' })),
  });
  const reward = decodeFunctionResult({
    abi,
    functionName: 'rewards',
    data: call(
      encodeFunctionData({ abi, functionName: 'rewards', args: [report.mergeId as Hex] }),
    ),
  });
  if (
    repo !== report.repositoryKey ||
    reward[0] !== BigInt(report.amountMicro) ||
    reward[2] !== report.reportHash ||
    reward[3] !== BigInt(report.mergedAt) ||
    reward[0] > BigInt(report.maxRewardMicro)
  )
    throw Error('Automatic MR reward mismatch');
  const cap = decodeFunctionResult({
    abi,
    functionName: 'maxRewardMicro',
    data: call(encodeFunctionData({ abi, functionName: 'maxRewardMicro' })),
  });
  const eligible = decodeFunctionResult({
    abi,
    functionName: 'fundingAt',
    data: call(
      encodeFunctionData({
        abi,
        functionName: 'fundingAt',
        args: [BigInt(report.mergedAt)],
      }),
    ),
  });
  if (!eligible || cap !== BigInt(report.maxRewardMicro) || reward[1] > reward[0]) {
    throw Error('Funding history or immutable cap mismatch');
  }
  const result = JSON.stringify({
    result: 'CRE_VALIDATED',
    chainId: 5042002,
    mergeId: report.mergeId,
    reportHash: report.reportHash,
  });
  runtime.log(result);
  return result;
}
function initWorkflow(config: Config) {
  return [
    cre.handler(
      new cre.capabilities.CronCapability().trigger({ schedule: config.schedule }),
      onCron,
    ),
  ];
}
export async function main() {
  const runner = await Runner.newRunner<Config>({
    configParser: (config) => configSchema.parse(config),
  });
  await runner.run(initWorkflow);
}
main();
