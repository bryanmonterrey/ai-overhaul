// app/components/layout/Header.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '../common/Card';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { connected, publicKey, disconnect } = useWallet();
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await disconnect();
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="font-mono text-white text-lg">
              GOATSE SINGULARITY AI
            </Link>
             
            <nav className="hidden md:flex space-x-6">
              <Link href="/chat" className="font-mono text-white hover:text-white">
                [CHAT]
              </Link>
              <Link href="/twitter" className="font-mono text-white hover:text-white">
                [TWITTER]
              </Link>
              <Link href="/telegram" className="font-mono text-white hover:text-white">
                [TELEGRAM]
              </Link>
              <Link href="/admin" className="font-mono text-white hover:text-white">
                [ADMIN]
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <Card variant="system" className="px-3 py-1">
              <span className="text-xs">STATUS: ONLINE</span>
            </Card>
            
            {connected && publicKey ? (
              <div className="flex items-center space-x-4">
                <Card variant="system" className="px-3 py-1">
                  <span className="text-xs font-mono">
                    {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                  </span>
                </Card>
                <button
                  onClick={handleSignOut}
                  className="font-mono text-white border border-white py-2 px-3 hover:text-red-500 text-xs"
                >
                  DISCONNECT
                </button>
              </div>
            ) : (
              <WalletMultiButton className="!bg-transparent !border !border-white !rounded-none !font-mono !text-sm !px-3 !py-1" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}