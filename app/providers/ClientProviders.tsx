// app/providers/ClientProviders.tsx
'use client';

import { WalletProvider } from './WalletProvider';
import React from 'react';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
}