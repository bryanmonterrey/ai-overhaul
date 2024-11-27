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
    <div className="h-full flex items-center font-mono justify-center bg-black">
      <div className="max-w-md w-full space-y-8 p-8 bg-black border border-white rounded-none shadow-none">
        <div>
          <h2 className="text-center text-xl font-mono text-white">
            Connect Your Wallet
          </h2>
          <p className="mt-2 text-center  font-mono text-sm text-gray-300">
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