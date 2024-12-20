/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
      '@solana/wallet-adapter-base',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-react-ui',
      '@solana/wallet-adapter-wallets',
      '@solana/web3.js'
  ],
  webpack: (config, { isServer }) => {
      if (!isServer) {
          config.resolve.fallback = {
              ...config.resolve.fallback,
              fs: false,
              net: false,
              tls: false,
              crypto: require.resolve('crypto-browserify'),
              stream: require.resolve('stream-browserify'),
              buffer: require.resolve('buffer/')
          }
      }
      config.module.rules.push({
          test: /\.m?js$/,
          type: 'javascript/auto',
          resolve: {
              fullySpecified: false,
          },
      });
      return config
  },
  typescript: {
      ignoreBuildErrors: true
  },
  eslint: {
      ignoreDuringBuilds: true
  },
  async rewrites() {
      if (process.env.NODE_ENV === 'development') {
        return [
          {
            source: '/api/memory/:path*',
            destination: 'http://localhost:3001/:path*'
          }
        ];
      } else {
        if (!process.env.NEXT_PUBLIC_PYTHON_API_URL) {
          console.warn('NEXT_PUBLIC_PYTHON_API_URL not set in production!');
        }
        return [
          {
            source: '/api/memory/:path*',
            destination: `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/:path*`
          }
        ];
      }
  }
}

export default nextConfig