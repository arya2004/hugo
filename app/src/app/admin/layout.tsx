import type { ReactNode } from 'react';
import Link from 'next/link';
import { SignOut } from '../../components/client';
import { Private } from '../../components/private';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Private destination="/admin">
      <div className="workspace-shell">
        <aside className="workspace-sidebar">
          <span className="workspace-role">ADMIN</span>
          <h2>Repository owner</h2>
          <p>Fund your repositories and set their automatic reward limits.</p>
          <nav aria-label="Admin workspace">
            <Link href="/admin">My projects</Link>
            <Link href="/admin/projects/new">Register repository</Link>
          </nav>
          <div className="workspace-switch">
            <span>Looking for your own rewards?</span>
            <Link href="/contributor">Open private claim ↗</Link>
          </div>
          <SignOut />
        </aside>
        <section className="workspace-content">{children}</section>
      </div>
    </Private>
  );
}
