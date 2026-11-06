import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function ClaimLayout({ children }: { children: ReactNode }) {
  return <section className="private-claim-shell">{children}</section>;
}
