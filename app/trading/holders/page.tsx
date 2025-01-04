'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { HolderDashboard } from './components/HolderDashboard';
import { HolderTradingChat } from './components/HolderTradingChat';
import { TokenChecker } from '../../lib/blockchain/token-checker';

export default function HolderTradingPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        console.log("Starting access check...");
        
        // Check if user is logged in
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log("Session check result:", { session, error: sessionError });
        
        if (!session) {
          console.log("No session found, redirecting to login");
          router.push('/login');
          return;
        }

        try {
          // Check if token gating is enabled
          console.log("Checking token gate settings...");
          const { data: settings, error: settingsError } = await supabase
            .from('admin_settings')
            .select('*')
            .eq('key', 'token_gate_enabled')
            .single();
            
          console.log("Token gate settings result:", { settings, error: settingsError });

          // Continue even if settings check fails
          if (settingsError) {
            console.warn("Error checking token gate settings:", settingsError);
            // Don't return, continue with the flow
          }

          // Get user's wallet address
          console.log("Fetching user wallet address...");
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('id', session.user.id)
            .single();
            
          console.log("User data result:", { userData, error: userError });

          if (userError || !userData?.wallet_address) {
            console.error("No wallet address found:", userError);
            router.push('/insufficient-tokens');
            return;
          }

          // Token eligibility check
          console.log("Checking token eligibility...");
          const tokenChecker = new TokenChecker();
          const { isEligible, value } = await tokenChecker.checkEligibility(userData.wallet_address);
          console.log("Eligibility result:", { isEligible, value });

          if (!isEligible) {
            console.log("User not eligible, updating database...");
            await supabase
              .from('token_holders')
              .upsert({
                user_id: session.user.id,
                wallet_address: userData.wallet_address,
                dollar_value: value,
                last_checked: new Date().toISOString()
              }, {
                onConflict: 'user_id'
              });

            router.push('/insufficient-tokens');
            return;
          }

          setWalletAddress(userData.wallet_address);
          setError(null);
        } catch (innerError) {
          console.error("Error in access check:", innerError);
          setError("Error checking access. Please try again.");
        }

      } catch (error) {
        console.error('Error in main access check:', error);
        setError("Authentication error. Please log in again.");
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [supabase, router]);

  if (isLoading) {
    return <div className="container mx-auto p-6">Checking access...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-6 text-red-500">{error}</div>;
  }

  if (!walletAddress) {
    return <div className="container mx-auto p-6">No wallet address found. Please connect your wallet.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="lg:col-span-2 mb-14">
        <HolderTradingChat userAddress={walletAddress} />
      </div>
      <h1 className="text-2xl font-bold mb-6">Trading Dashboard</h1>
      <HolderDashboard userAddress={walletAddress} />
    </div>
  );
}