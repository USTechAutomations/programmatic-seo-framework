/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static exports for deployment flexibility
  // Uncomment if deploying to static hosting (S3, GitHub Pages, etc.)
  // output: 'export',

  // Trailing slashes for consistent URLs
  trailingSlash: true,

  // Image optimization
  images: {
    // For static export, use unoptimized
    // unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports
    optimizePackageImports: ['date-fns'],
  },

  // Redirect www to non-www (or vice versa)
  async redirects() {
    return [
      // Add any URL redirects here
      // {
      //   source: '/old-path',
      //   destination: '/new-path',
      //   permanent: true,
      // },
    ];
  },

  // Custom headers for SEO and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        // Cache blog pages for 1 hour, revalidate in background
        source: '/blog/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Handle markdown files if needed
    config.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    });

    return config;
  },
};

module.exports = nextConfig;
