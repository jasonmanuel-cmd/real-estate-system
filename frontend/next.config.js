/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for the Docker production image (next build emits a
  // self-contained server bundle in .next/standalone).
  output: 'standalone',
  experimental: {
    // npm workspaces hoist deps to the repo root; without this, standalone
    // output can't trace them and the Docker image ships without node_modules.
    outputFileTracingRoot: __dirname + '/..',
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
