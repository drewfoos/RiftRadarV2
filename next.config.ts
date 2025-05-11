/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ddragon.leagueoflegends.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.communitydragon.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.communitydragon.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  // API configuration for external Riot API requests
  // This is important to avoid CORS issues with Data Dragon
  async rewrites() {
    return [
      {
        // Handle DataDragon requests
        source: '/api/ddragon/:path*',
        destination: 'https://ddragon.leagueoflegends.com/cdn/:path*',
      },
      {
        // Handle Community Dragon requests
        source: '/api/cdragon/:path*',
        destination: 'https://raw.communitydragon.org/:path*',
      },
      {
        // Handle Riot API versions endpoint
        source: '/api/versions',
        destination: 'https://ddragon.leagueoflegends.com/api/versions.json',
      },
    ];
  },

  // Turbopack configuration (stable in Next.js 15)
  turbopack: {
    // Configure resolve aliases for modules
    resolveAlias: {
      // Example: Map underscore imports to lodash (if needed)
      // underscore: 'lodash',
    },
    
    // Add custom file extensions for module resolution
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json', '.mdx'],
    
    // SVG loader example (if you're using SVGs from Data Dragon)
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // Configure server runtime (for Neon Postgres)
  serverRuntimeConfig: {
    // Used for server-only environment variables (like DATABASE_URL)
    PROJECT_ROOT: __dirname,
  },
  
  // Configure headers for API security
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' }, // Be cautious with '*' in production
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  
  // Handle TypeScript paths
  transpilePackages: ['@trpc/server', '@trpc/client'],
  
  // Use Lightning CSS instead of optimizeCss (much faster CSS minifier)
  experimental: {
    // Enable Lightning CSS for CSS minification
    useLightningcss: true,
  },
};

export default nextConfig;
