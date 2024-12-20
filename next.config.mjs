/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
      '@solana/wallet-adapter-base',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-react-ui',
      '@solana/wallet-adapter-wallets',
      '@solana/web3.js',
      'twitter-api-v2'
  ],
  webpack: (config, { isServer }) => {
      if (!isServer) {
          config.resolve = {
              ...config.resolve,
              fallback: {
                  ...config.resolve?.fallback,
                  fs: false,
                  net: false,
                  tls: false,
                  crypto: false,
                  stream: false,
                  buffer: false
              }
          }
      }

      config.module.rules.push({
          test: /\.m?js$/,
          type: 'commonjs',
          resolve: {
              fullySpecified: false,
          },
      });

      if (isServer) {
          config.externals.push('twitter-api-v2')
      }

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