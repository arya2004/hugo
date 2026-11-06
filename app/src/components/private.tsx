import type { ReactNode } from 'react';
import { principal, owner } from '../server/auth';
import { Login } from './client';

export async function Private({
  children,
  programId,
  destination = '/contributor',
}: {
  children: ReactNode;
  programId?: string;
  destination?: string;
}) {
  try {
    const p = await principal();
    if (programId) {
      await owner(programId, p);
    }
  } catch (e) {
    return (
      <section className="card pagehead">
        <span className="eyebrow">PRIVATE WORKSPACE</span>
        <h1>Sign in to continue.</h1>
        <p>{e instanceof Error ? e.message : 'Authentication required'}</p>
        <Login next={destination} />
      </section>
    );
  }
  return children;
}
