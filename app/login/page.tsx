'use client';

import { WalletConnection } from '@/app/components/WalletConnection';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { connected } = useWallet();

  useEffect(() => {
    console.log('Wallet connected status:', connected);
  }, [connected]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('User session found, redirecting to chat');
        router.push('/chat');
      } else {
        console.log('No session found, showing login page');
        setLoading(false);
      }
    };
    checkSession();
  }, [supabase, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-lg shadow-xl">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-white">
            Connect Your Wallet
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            To access the chat, you need to verify your $GOATSE tokens
          </p>
        </div>

        <div className="mt-8">
          <WalletConnection />
        </div>
      </div>
    </div>
  );
}