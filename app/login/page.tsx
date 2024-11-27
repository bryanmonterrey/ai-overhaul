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
  const { connected, publicKey } = useWallet();

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

  // Handle wallet connection
  useEffect(() => {
    const handleWalletLogin = async () => {
      if (!connected || !publicKey) return;

      try {
        console.log('Wallet connected, signing in with Supabase');
        const message = `Login with wallet: ${publicKey.toString()}`;
        
        // Sign in with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email: `${publicKey.toString()}@wallet.local`, // Use wallet address as email
          password: process.env.NEXT_PUBLIC_WALLET_AUTH_SECRET || 'default-secret' // You should set this in your env
        });

        if (error) {
          // If user doesn't exist, sign them up
          if (error.message.includes('Email not confirmed')) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: `${publicKey.toString()}@wallet.local`,
              password: process.env.NEXT_PUBLIC_WALLET_AUTH_SECRET || 'default-secret',
              options: {
                data: {
                  wallet_address: publicKey.toString()
                }
              }
            });

            if (signUpError) {
              console.error('Error signing up:', signUpError);
              return;
            }
          } else {
            console.error('Error signing in:', error);
            return;
          }
        }

        console.log('Successfully authenticated with Supabase');
        router.push('/chat');
      } catch (error) {
        console.error('Error during authentication:', error);
      }
    };

    handleWalletLogin();
  }, [connected, publicKey, supabase, router]);

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
          <p className="mt-2 text-center font-mono text-sm text-gray-300">
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