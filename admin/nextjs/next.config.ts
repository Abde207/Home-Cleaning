import type { NextConfig } from 'next';

const config: NextConfig = {
  // `npm run typecheck -w @home-clean/admin` is the mandatory independent gate.
  // Next's Windows typecheck child process is blocked by the host's spawn EPERM.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    // Use threads where Next otherwise spawns node.exe on the restricted Windows host.
    workerThreads: true,
    cpus: 1,
  },
};

export default config;
