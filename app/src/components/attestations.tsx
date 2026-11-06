'use client';

import { LiveData } from './client';

export function Attestations() {
  return (
    <LiveData path="arkiv/contributions">
      {(records) =>
        records.length ? (
          <div className="grid">
            {records.map((record: any) => (
              <article className="card" key={record.entityKey}>
                <span className="tag">{record.eligibility}</span>
                <h2>Merge {record.mergeSha.slice(0, 10)}</h2>
                <p>{record.settlement}</p>
                <p className="funding-address">Arkiv entity: {record.entityKey}</p>
                <p className="funding-address">
                  Settlement: {record.reference || 'No funded settlement'}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p>No public attestations found for this issuer.</p>
        )
      }
    </LiveData>
  );
}
