import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hugo — fund your project',
  description:
    'Private repository funding for project admins, with individual rewards for verified contributors.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link className="brand" href="/">
            <span className="brandmark">↗</span>
            <span>
              Hugo<span className="branddot">.</span>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/admin">Admin / Repo owner</Link>
            <Link className="navcta" href="/redeem">
              Contributor rewards ↗
            </Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <div>
            <strong>Good work deserves a future.</strong>
            <p>Hugo · Private project workspaces</p>
          </div>
          <div>
            <span className="tag">ARC TESTNET ONLY</span>
            <p>Owner + community funding · Public blockchain transactions</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
