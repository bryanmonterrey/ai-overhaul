// app/components/WalletConnection.tsx
'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';

export function WalletConnection() {
  const { publicKey, connected, connecting, disconnect, wallet } = useWallet();
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    console.log('Wallet state:', {
      connected,
      connecting,
      publicKey: publicKey?.toString(),
      walletName: wallet?.adapter?.name
    });
  }, [connected, connecting, publicKey, wallet]);

  const handleValidateTokens = async () => {
    if (!publicKey) {
      console.log('No public key available');
      return;
    }
    
    setIsValidating(true);
    try {
      console.log('Validating tokens for wallet:', publicKey.toString());
      const response = await fetch('/api/token-validation', {
        method: 'POST',
        credentials: 'include', // Include cookies
        headers: {
          'Content-Type': 'application/json',
          // Add CSRF token if you have one
          ...(document.cookie.includes('csrf-token') && {
            'X-CSRF-Token': document.cookie
              .split('; ')
              .find(row => row.startsWith('csrf-token'))
              ?.split('=')[1] || ''
          })
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
        }),
      });

      if (response.status === 401) {
        // Redirect to login if unauthorized
        window.location.href = `/login?redirect=${encodeURIComponent('/chat')}`;
        return;
      }

      const data = await response.json();
      console.log('Validation response:', data);
      
      if (data.isEligible) {
        window.location.href = '/chat';
      } else if (response.ok) {
        window.location.href = '/insufficient-tokens';
      } else {
        throw new Error(data.error || 'Validation failed');
      }
    } catch (error) {
      console.error('Error validating tokens:', error);
      // Show error to user
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <WalletMultiButton className="!bg-blue-500 hover:!bg-blue-600" />
      
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
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600 transition-colors"
          >
            {isValidating ? 'Validating...' : 'Verify Token Holdings'}
          </button>
          <button
            onClick={() => disconnect()}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors w-full"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}