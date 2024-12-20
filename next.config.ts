// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    reactStrictMode: true,
    transpilePackages: [
        '@solana/wallet-adapter-base',
        '@solana/wallet-adapter-react',
        '@solana/wallet-adapter-react-ui',
        '@solana/wallet-adapter-wallets',
    ],
    serverExternalPackages: ['twitter-api-v2'],
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals.push('twitter-api-v2')
        }
        // Add this section for handling buffer in edge runtime
        if (!isServer) {
            config.resolve = {
                ...config.resolve,
                fallback: {
                    ...config.resolve?.fallback,
                    fs: false,
                    net: false,
                    tls: false,
                    crypto: require.resolve('crypto-browserify'),
                    stream: require.resolve('stream-browserify'),
                    buffer: require.resolve('buffer/'),
                }
            };
        }
        return config
    },
    // Add environment variables
    env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        TWITTER_API_KEY: process.env.TWITTER_API_KEY,
        TWITTER_API_SECRET: process.env.TWITTER_API_SECRET,
        TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    experimental: {
        serverComponentsExternalPackages: ['@solana/web3.js', 'rpc-websockets'],
    },
    async rewrites() {
        if (process.env.NODE_ENV === 'development') {
          // In development, use localhost
          return [
            {
              source: '/api/memory/:path*',
              destination: 'http://localhost:3001/:path*'
            }
          ];
        } else {
          // In production, rely on the NEXT_PUBLIC_PYTHON_API_URL
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