import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Os pacotes @optifi/* são fonte TypeScript; o Next compila-os in-place.
  transpilePackages: ['@optifi/core', '@optifi/data', '@optifi/ingest'],
  poweredByHeader: false,
  webpack: (config) => {
    // Os pacotes usam imports ESM com extensão .js que apontam para .ts
    config.resolve.extensionAlias = { '.js': ['.ts', '.js'] };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
