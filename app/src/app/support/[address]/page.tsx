import { notFound } from 'next/navigation';
import { address as addressSchema } from '../../../lib/core';
import { Donation } from '../../../components/client';

export default async function Support({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const parsed = addressSchema.safeParse(address);
  if (!parsed.success) {
    notFound();
  }
  return (
    <section className="card form">
      <h1>Support a repository</h1>
      <p className="funding-address">{parsed.data}</p>
      <p>
        Verify this treasury address with the project owner. All deposits fund contributor
        rewards. Donating does not change funding eligibility.
      </p>
      <Donation treasuryAddress={parsed.data} />
    </section>
  );
}
