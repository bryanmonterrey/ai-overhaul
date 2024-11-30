'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '../common/Card';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

const CustomWalletButton = () => {
  return (
    <WalletMultiButton className="!bg-[#11111A] !border !border-[#DDDDDD] !rounded-none !font-ia !text-sm !px-3 !py-1">
      SELECT&nbsp;WALLET
    </WalletMultiButton>
  );
};

export default function Header() {
  const { connected, publicKey, disconnect } = useWallet();
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#11111A] border-b border-[#DDDDDD]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center space-x-8">
            <Link href="/" className="font-ia text-[#DDDDDD] text-base">
              GOATSE SINGULARITY
            </Link>
             
            <nav className="hidden md:flex space-x-6">
              <Link href="/chat" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
                [CHAT]
              </Link>
              <Link href="/conversations" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
                [CONVERSATIONS]
              </Link>
              <Link href="/twitter" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
                [TWITTER]
              </Link>
              <Link href="/telegram" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
                [TELEGRAM]
              </Link>
              <Link href="/admin" className="font-ia text-[#DDDDDD] hover:text-[#DDDDDD]">
                [ADMIN]
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* Status card - hidden on small screens */}
            <Card variant="system" className="hidden sm:block px-3 py-1">
              <span className="text-xs">STATUS:&nbsp;ONLINE</span>
            </Card>

            {/* Menu button - shown only on small screens */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="sm:hidden text-xs px-5 py-2 border border-[#DDDDDD] text-white"
            >
              MENU
            </button>
            
            {connected && publicKey ? (
              <div className="flex items-center space-x-4">
                <Card variant="system" className="px-3 py-1">
                  <span className="text-xs font-ia">
                    {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                  </span>
                </Card>
                <button
                  onClick={handleSignOut}
                  className="font-ia bg-[#11111A] text-[#DDDDDD] border border-[#DDDDDD] py-2 px-3 hover:text-red-500 text-xs"
                >
                  DISCONNECT
                </button>
              </div>
            ) : (
              <CustomWalletButton />
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="sm:hidden border-t border-[#DDDDDD] py-2">
            <nav className="flex flex-col space-y-2">
              <Link href="/chat" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                [CHAT]
              </Link>
              <Link href="/conversations" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                [CONVERSATIONS]
              </Link>
              <Link href="/twitter" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                [TWITTER]
              </Link>
              <Link href="/telegram" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                [TELEGRAM]
              </Link>
              <Link href="/admin" className="font-ia text-[#DDDDDD] px-4 py-2 hover:bg-[#DDDDDD]/10">
                [ADMIN]
              </Link>
              <div className="px-4 py-2">
                <span className="text-xs text-[#DDDDDD]">STATUS: ONLINE</span>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}