import { required } from '../src/server/env';

const url = new URL('/api/internal/arkiv/sync', required('POC_APP_URL'));
if (url.protocol !== 'https:') {
  throw Error('HTTPS required');
}
console.log(`Publishing queued attestations via ${url.origin}`);
let processed = 0;
for (let i = 0; i < 20; i++) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${required('WORKER_API_SECRET')}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json();
  if (!r.ok) {
    throw Error(`${j.error?.code ?? 'ARKIV_SYNC_FAILED'}: ${j.error?.message ?? 'Publication failed'} (HTTP ${r.status}, request ${j.requestId ?? 'unknown'}). ${processed} publication(s) succeeded in this run.`);
  }
  if (!j.data.processed) {
    console.log(j.data.reason === 'busy'
      ? 'Pending records are temporarily locked by another/earlier run. Retry in 3 minutes.'
      : 'No pending publications. Queue is up to date.');
    break;
  }
  processed++;
  console.log(JSON.stringify(j.data));
}
