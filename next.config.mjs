/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent @react-pdf/renderer from being bundled server-side
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },

  webpack: (config) => {
    // canvas is not available in Next.js server environment
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
