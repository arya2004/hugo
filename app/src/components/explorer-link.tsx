import type { ReactNode } from 'react';

const explorers = {
  arc: 'https://explorer.testnet.arc.io',
  arkiv: 'https://rabdi.explorer.arkiv.network',
};

export function ExplorerLink({
  value,
  network = 'arc',
  kind = 'tx',
  children,
}: {
  value: string;
  network?: keyof typeof explorers;
  kind?: 'tx' | 'address' | 'entity';
  children?: ReactNode;
}) {
  const valid = kind === 'address' ? /^0x[\da-fA-F]{40}$/ : /^0x[\da-fA-F]{64}$/;
  if (!valid.test(value)) {
    return <>{children ?? value}</>;
  }

  return (
    <a
      href={`${explorers[network]}/${kind}/${value}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Verify on ${network === 'arc' ? 'Arc Testnet' : 'Arkiv Rabdi'} explorer`}
    >
      {children ?? value}
    </a>
  );
}
