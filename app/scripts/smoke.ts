import assert from 'node:assert/strict';

const base = process.env.SMOKE_URL ?? 'http://127.0.0.1:3210';
for (const path of ['/', '/admin', '/admin/projects/new', '/redeem', '/arkiv']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  assert.match(await response.text(), /Proof of Contribution/);
  console.log(`PASS ${path} application HTML`);
}
const health = await fetch(base + '/api/health');
assert.equal(health.status, 200);
assert.equal(health.headers.get('cache-control'), 'no-store');
const result = await health.json();
assert.ok(result.requestId);
for (const dependency of ['db', 'arc']) {
  assert.ok(['ok', 'down'].includes(result.data[dependency]));
}
console.log('PASS health envelope:', JSON.stringify(result.data));
console.log('HTTP availability only; no authenticated live integration claimed.');
