import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['thirdweb', 'thirdweb/wallets', 'thirdweb/wallets/in-app'],
  },
  serverExternalPackages: ['@arkiv-network/sdk', 'viem'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
