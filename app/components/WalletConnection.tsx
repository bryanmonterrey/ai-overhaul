// app/components/WalletConnection.tsx
'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import WalletMultiButton with no SSR
const WalletMultiButtonDynamic = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

export function WalletConnection() {
  const { publicKey, connected, connecting, disconnect, wallet } = useWallet();
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      console.log('Wallet state:', {
        connected,
        connecting,
        publicKey: publicKey?.toString(),
        walletName: wallet?.adapter?.name
      });
    }
  }, [mounted, connected, connecting, publicKey, wallet]);

  const handleValidateTokens = async () => {
    if (!publicKey) {
      console.log('No public key available');
      return;
    }
    
    setIsValidating(true);
    setIsChecking(true);  // Add this line
    setValidationError(null);
    
    try {
      const walletAddress = publicKey.toString();
      console.log('Starting token validation for wallet:', walletAddress);
      
      const response = await fetch('/api/token-validation', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress }),
      });

      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('Validation response:', data);
      
      if (!response.ok) {
        if (response.status === 401) {
          console.log('Unauthorized. Redirecting to login...');
          window.location.href = `/login?redirect=${encodeURIComponent('/chat')}`;
          return;
        }
        throw new Error(data.error || 'Validation failed');
      }

      if (data.isEligible) {
        console.log('Token validation successful. Redirecting to chat...');
        window.location.href = '/chat';
      } else {
        console.log('Insufficient tokens. Redirecting...');
        window.location.href = '/insufficient-tokens';
      }
    } catch (error: any) {
      console.error('Error in token validation:', error);
      setValidationError(error.message);
    } finally {
      setIsValidating(false);
      setIsChecking(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <WalletMultiButtonDynamic />
      
      {connecting && (
        <p className="text-sm text-gray-400">Connecting...</p>
      )}
      
      {connected && publicKey && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400">
            Connected: {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
          </p>
          <button
            onClick={handleValidateTokens}
            disabled={isValidating}
            className="px-4 py-2 bg-[#11111A] text-white rounded disabled:opacity-50 hover:bg-white/10 transition-colors border border-white w-full"
          >
            {isValidating ? 'Validating...' : 'Verify Token Holdings'}
          </button>
          {validationError && (
            <p className="text-sm text-red-500">{validationError}</p>
          )}
          <button
            onClick={() => disconnect()}
            className="px-4 py-2 bg-[#11111A] border border-white text-white rounded hover:bg-white/10 transition-colors w-full"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}