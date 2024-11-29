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
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('Existing session found, redirecting to chat');
          router.push('/chat');
        } else {
          console.log('No session found, showing login page');
          setLoading(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setLoading(false);
      }
    };
    checkSession();
  }, [supabase, router]);

  // Handle wallet authentication
  useEffect(() => {
    const handleWalletLogin = async () => {
      // Only proceed if wallet is connected and not already authenticating
      if (!connected || !publicKey || isAuthenticating) return;

      try {
        setIsAuthenticating(true);
        console.log('Starting wallet authentication for:', publicKey.toString());

        // Try to sign up first
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
          console.log('Sign up attempt result:', signUpError.message);
          
          // If user already exists, try to sign in
          if (signUpError.message.includes('User already registered')) {
            console.log('User exists, attempting sign in');
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: `${publicKey.toString()}@wallet.local`,
              password: process.env.NEXT_PUBLIC_WALLET_AUTH_SECRET || 'default-secret'
            });

            if (signInError) {
              console.error('Sign in error:', signInError);
              return;
            }

            if (signInData.session) {
              console.log('Successfully signed in');
              router.push('/chat');
            }
          } else {
            console.error('Unexpected error during signup:', signUpError);
          }
        } else if (signUpData.session) {
          console.log('Successfully signed up and authenticated');
          router.push('/chat');
        }
      } catch (error) {
        console.error('Authentication error:', error);
      } finally {
        setIsAuthenticating(false);
      }
    };

    handleWalletLogin();
  }, [connected, publicKey, supabase, router, isAuthenticating]);

  if (loading) {
    return <div className="h-full flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>;
  }

  return (
    <div className="h-full flex items-center font-ia justify-center bg-[#11111A]">
      <div className="max-w-md w-full space-y-8 p-8 bg-[#11111A] border border-white rounded-none shadow-none">
        <div>
          <h2 className="text-center text-xl font-ia text-white">
            Connect Your Wallet
          </h2>
          <p className="mt-2 text-center font-ia text-sm text-gray-300">
            To access the chat, you need to verify your $GOATSE tokens
          </p>
        </div>

        <div className="mt-8">
          <WalletConnection />
        </div>

        {isAuthenticating && (
          <p className="text-center text-sm text-gray-400">
            Authenticating...
          </p>
        )}
      </div>
    </div>
  );
}