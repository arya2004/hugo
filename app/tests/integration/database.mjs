import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poc-db-test-'));
const run = (command, args) => {
  const r = spawnSync(command, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw Error(`${command}: ${r.stderr || r.stdout}`);
  }
};
run('initdb', ['-D', path.join(dir, 'data'), '-A', 'trust', '--no-locale', '-E', 'UTF8']);
run('pg_ctl', [
  '-D',
  path.join(dir, 'data'),
  '-l',
  path.join(dir, 'server.log'),
  '-o',
  `-k ${dir} -p 55439 -h ''`,
  '-w',
  'start',
]);
const pool = new pg.Pool({ host: dir, port: 55439, database: 'postgres', max: 10 });
let passed = 0;

async function test(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
const b32 = () =>
  `0x${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`;
try {
  await pool.query(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);`,
  );
  for (const file of fs
    .readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await pool.query(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  console.log('PASS all migrations applied to isolated real PostgreSQL');
  passed++;
  const actor = randomUUID(),
    other = randomUUID(),
    program = randomUUID(),
    repo = randomUUID();
  await pool.query('insert into auth.users values($1),($2)', [actor, other]);
  await pool.query(
    `insert into programs(id,chain_program_id,name,owner_auth_user_id,owner_github_id,owner_wallet,voucher_signer,policy,created_tx_hash) values($1,$2,'Test program',$3,'101',$4,$5,'CONTINUOUS',$6)`,
    [program, b32(), actor, '0x' + '11'.repeat(20), '0x' + '22'.repeat(20), b32()],
  );
  await pool.query(
    `insert into repositories(id,program_id,provider,external_repo_id,full_name) values($1,$2,'github','123','test/repo')`,
    [repo, program],
  );
  const start = new Date(Date.now() - 3 * 86400000).toISOString();
  const end = new Date(Date.now() - 86400000).toISOString();
  const merge = randomUUID(),
    eh = b32();
  await pool.query(
    "insert into merge_events(id,repository_id,provider,external_repo_id,pr_number,merge_sha,merged_at) values($1,$2,'github','123',1,$3,$4)",
    [merge, repo, 'a'.repeat(40), new Date(Date.now() - 2 * 86400000).toISOString()],
  );
  const scores = [
    {
      provider: 'github',
      providerUserId: '101',
      role: 'CONTRIBUTOR',
      impactScore: 80,
      justification: 'Code contribution',
      evidenceKeys: ['commit:a'],
    },
    {
      provider: 'github',
      providerUserId: '202',
      role: 'CONTRIBUTOR',
      impactScore: 20,
      justification: 'Tests contribution',
      evidenceKeys: ['commit:b'],
    },
  ];
  await pool.query('select save_evaluation($1,$2,$3,$4)', [
    merge,
    { evidenceHash: eh },
    { model: 'explicit-local-test', inferenceRequestId: 'local-test' },
    JSON.stringify(scores),
  ]);
  await test('funding history preserves active merges after stop; mixed recipients reserve atomically', async () => {
    await pool.query('update programs set contract_version=2 where id=$1', [program]);
    await pool.query(
      'insert into funding_transitions(program_id,effective_at,active,block_number,log_index,tx_hash) values($1,$2,true,1,0,$4),($1,$3,false,2,0,$5)',
      [program, start, end, b32(), b32()],
    );
    await pool.query(
      'insert into donations(program_id,tx_hash,log_index,block_number,block_timestamp,donor_wallet,amount_micro) values($1,$2,0,1,$3,$4,700000000)',
      [program, b32(), start, '0x' + '11'.repeat(20)],
    );
    await pool.query(
      "insert into contributor_wallets values('github','101',$1,'test-thirdweb-user',now())",
      ['0x' + '11'.repeat(20)],
    );
    const report = { availableMicro: '100000000', inflowMicro: '700000000' };
    const rows = [
      {
        provider: 'github',
        providerUserId: '101',
        claimId: b32(),
        amountMicro: '51200000',
      },
      {
        provider: 'github',
        providerUserId: '202',
        claimId: b32(),
        amountMicro: '12800000',
      },
    ];
    const reserve = () =>
      pool.query('select freeze_merge_reservation($1,$2,$3,$4,$5) id', [
        merge,
        eh,
        eh,
        report,
        JSON.stringify(rows),
      ]);
    const results = await Promise.all([reserve(), reserve()]);
    assert.equal(results[0].rows[0].id, results[1].rows[0].id);
    const id = results[0].rows[0].id;
    const allocations = (
      await pool.query(
        'select * from merge_allocations where reservation_id=$1 order by provider_user_id',
        [id],
      )
    ).rows;
    assert.equal(allocations.length, 2);
    assert.equal(allocations[0].auto_pay, true);
    assert.equal(allocations[1].auto_pay, false);
    assert.equal(
      (await pool.query('select amount_micro from merge_reservations where id=$1', [id]))
        .rows[0].amount_micro,
      '64000000',
    );
    await pool.query("update merge_reservations set status='RESERVED' where id=$1", [id]);
    assert.equal(
      (
        await pool.query('select lock_allocation_recipient($1,$2,$3,$4) ok', [
          allocations[0].id,
          'github',
          '202',
          '0x' + '11'.repeat(20),
        ])
      ).rows[0].ok,
      false,
    );
    assert.equal(
      (
        await pool.query('select lock_allocation_recipient($1,$2,$3,$4) ok', [
          allocations[0].id,
          'github',
          '101',
          '0x' + '11'.repeat(20),
        ])
      ).rows[0].ok,
      true,
    );
  });
  console.log(`PASS ${passed} focused database cases; isolated PostgreSQL only.`);
} finally {
  await pool.end();
  run('pg_ctl', ['-D', path.join(dir, 'data'), '-m', 'immediate', '-w', 'stop']);
  fs.rmSync(dir, { recursive: true, force: true });
}
