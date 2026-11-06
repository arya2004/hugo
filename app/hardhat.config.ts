import { defineConfig } from 'hardhat/config';
export default defineConfig({
  solidity: '0.8.30',
  networks: {
    localArc: {
      type: 'edr-simulated',
      chainType: 'l1',
      chainId: 5042002,
      hardfork: 'shanghai',
    },
  },
});
