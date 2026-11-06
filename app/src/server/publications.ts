import 'server-only';
import { publishAttestation } from './arkiv';
import { db, one, query, rpc } from './db';
import { projectState } from './project-chain';

export async function syncPublication() {
  const publication = await rpc<any>('lease_v2_publication', {});
  if (!publication) {
    const pending = await query<any[]>(
      db().from('attestation_publications').select('leased_until').eq('pending', true),
    );
    return { processed: false, reason: pending.length ? 'busy' : 'empty' };
  }
  try {
    const isProgram = publication.kind === 'Program';
    const reservation = isProgram
      ? null
      : await one('merge_reservations', publication.subject_id);
    const program = await one(
      'programs',
      isProgram ? publication.subject_id : reservation.program_id,
    );
    const merge = reservation
      ? await one('merge_events', reservation.merge_event_id)
      : null;
    const payments = reservation
      ? await query<any[]>(
          db()
            .from('merge_allocations')
            .select('status,payment_tx_hash')
            .eq('reservation_id', reservation.id),
        )
      : [];
    const state = isProgram ? await projectState(program.treasury_address) : null;
    // Arkiv str values allow 128 bytes. Store one complete transaction hash,
    // preferring a confirmed payout; never concatenate hashes into this field.
    const result = await publishAttestation({
      kind: publication.kind,
      subject: publication.subject_id,
      revision: String(publication.revision),
      programId: program.id,
      name: program.name,
      treasury: program.treasury_address,
      mergeSha: merge?.merge_sha ?? '',
      evidenceHash: reservation?.report_json.evidenceHash ?? '',
      eligibility: isProgram
        ? state?.active
          ? 'ACTIVE'
          : 'STOPPED'
        : reservation.report_json.eligible
          ? 'ELIGIBLE'
          : 'INELIGIBLE',
      settlement: reservation
        ? `${reservation.status};paid=${payments.filter((p) => p.status === 'PAID').length}/${payments.length}`
        : '',
      reference: isProgram
        ? program.deployment_tx_hash
        : payments.find((p) => p.status === 'PAID' && p.payment_tx_hash)?.payment_tx_hash
          ?? reservation.reserve_tx_hash
          ?? '',
    });
    await query(
      db()
        .from('attestation_publications')
        .update({
          pending: false,
          entity_key: result.entityKey,
          tx_hash: result.txHash,
          leased_until: null,
          lease_token: null,
        })
        .eq('subject_id', publication.subject_id)
        .eq('kind', publication.kind)
        .eq('revision', publication.revision)
        .eq('lease_token', publication.lease_token),
    );
    return { processed: true, entityKey: result.entityKey, txHash: result.txHash };
  } catch (error) {
    await query(
      db().from('attestation_publications')
        .update({ lease_token: null, leased_until: null })
        .eq('subject_id', publication.subject_id)
        .eq('kind', publication.kind)
        .eq('lease_token', publication.lease_token),
    ).catch(() => undefined);
    throw error;
  }
}
