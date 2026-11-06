import { required } from '../src/server/env';

const url = new URL('/api/internal/arkiv/sync', required('POC_APP_URL'));
if (url.protocol !== 'https:') {
  throw Error('HTTPS required');
}
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
    throw Error(j.error?.code ?? 'ARKIV_SYNC_FAILED');
  }
  if (!j.data.processed) {
    break;
  }
  console.log(JSON.stringify(j.data));
}
