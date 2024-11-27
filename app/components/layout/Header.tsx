// src/app/components/layout/Header.tsx

import React from 'react';
import Link from 'next/link';
import { Card } from '../common/Card';

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="font-mono text-white text-lg">
              GOATSE SINGULARITY AI
            </Link>
            
            <nav className="hidden md:flex space-x-6">
              <Link href="/chat" className="font-mono text-white hover:text-white">
                [CHAT]
              </Link>
              <Link href="/twitter" className="font-mono text-white hover:text-white">
                [TWITTER]
              </Link>
              <Link href="/telegram" className="font-mono text-white hover:text-white">
                [TELEGRAM]
              </Link>
              <Link href="/admin" className="font-mono text-white hover:text-white">
                [ADMIN]
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <Card variant="system" className="px-3 py-1">
              <span className="text-xs">STATUS: ONLINE</span>
            </Card>
          </div>
        </div>
      </div>
    </header>
  );
}