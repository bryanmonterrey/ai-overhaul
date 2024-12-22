'use client';

import { WalletConnection } from '../components/WalletConnection';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { TokenChecker } from '../lib/blockchain/token-checker';
import { Turnstile } from '@marsidev/react-turnstile';

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { connected, publicKey } = useWallet();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || 'your-site-key';

  const handleCaptchaVerify = (token: string) => {
    console.log('Captcha verified:', token);
    setCaptchaToken(token);
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const tokenChecker = new TokenChecker();
          const { isEligible } = await tokenChecker.checkEligibility(session.user.user_metadata.wallet_address);

          if (isEligible) {
            console.log('Session valid and tokens verified, redirecting to chat');
            router.push('/chat');
          } else {
            console.log('Insufficient tokens, logging out');
            await supabase.auth.signOut();
            setError('Insufficient GOATSE tokens');
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Session check error:', error);
        setLoading(false);
      }
    };

    checkSession();
  }, [supabase, router]);

  const handleWalletLogin = async () => {
    if (!connected || !publicKey || isAuthenticating || !captchaToken) return;

    try {
      setIsAuthenticating(true);
      setError(null);

      // Step 1: Verify CAPTCHA server-side
      const captchaResponse = await fetch('/api/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: captchaToken }),
      });

      const captchaResult = await captchaResponse.json();

      if (!captchaResult.success) {
        throw new Error('CAPTCHA verification failed.');
      }

      // Step 2: Check token eligibility
      const tokenChecker = new TokenChecker();
      const { isEligible, value } = await tokenChecker.checkEligibility(publicKey.toString());

      if (!isEligible) {
        setError('Insufficient GOATSE tokens');
        return;
      }

      // Step 3: Sign up or sign in
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: `${publicKey.toString()}@wallet.local`,
        password: process.env.NEXT_PUBLIC_WALLET_AUTH_SECRET || 'default-secret',
        options: {
          data: {
            wallet_address: publicKey.toString(),
            token_value: value,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: `${publicKey.toString()}@wallet.local`,
            password: process.env.NEXT_PUBLIC_WALLET_AUTH_SECRET || 'default-secret',
          });

          if (signInError) {
            throw new Error('Authentication failed.');
          }

          if (signInData.session) {
            router.push('/chat');
          }
        } else {
          throw new Error('Authentication failed.');
        }
      } else if (signUpData.session) {
        router.push('/chat');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      setError(error.message || 'An unknown error occurred');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center font-ia justify-center bg-[#11111A]">
      <div className="max-w-md w-full space-y-8 p-8 bg-[#0D0E15] border border-zinc-900 rounded-md shadow-none">
        <div>
          <h2 className="text-center text-xl font-ia text-[#DDDDDD]">
            Connect Your Wallet
          </h2>
          <p className="mt-2 text-center font-ia text-sm text-[#DDDDDD]">
            To access the chat, you need to verify your $GOATSE SINGULARITY tokens
          </p>
          {error && (
            <p className="mt-2 text-center font-ia text-sm text-red-500">
              {error}
            </p>
          )}
        </div>

        <div className="mt-8">
          <WalletConnection />
        </div>

        <div className="mt-4 mx-auto w-full flex items-center justify-center">
          <Turnstile
            siteKey={turnstileSiteKey}
            onSuccess={handleCaptchaVerify}
          />
        </div>

        {isAuthenticating && (
          <p className="text-center text-sm text-[#DDDDDD]">
            Authenticating...
          </p>
        )}
      </div>
    </div>
  );
}
