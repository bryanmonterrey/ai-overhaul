// src/app/components/layout/Sidebar.tsx

import React from 'react';
import Link from 'next/link';
import { Card } from '../common/Card';
import { EmotionalState } from '../../core/types';

interface SidebarProps {
  currentState?: {
    emotionalState: EmotionalState;
    narrativeMode: string;
    activeThemes: string[];
  };
}

export default function Sidebar({ currentState }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-black border-r border-white overflow-y-auto">
      <div className="p-4 space-y-4">
        <Card variant="system" title="SYSTEM_INFO">
          <div className="text-xs space-y-1">
            <div>emotional_state: {currentState?.emotionalState || 'initializing'}</div>
            <div>narrative_mode: {currentState?.narrativeMode || 'default'}</div>
          </div>
        </Card>

        <nav className="space-y-2">
          <div className="text-white text-sm mb-2">NAVIGATION:</div>
          {[
            { href: '/chat', label: 'Direct Interface' },
            { href: '/twitter', label: 'Twitter Module' },
            { href: '/telegram', label: 'Telegram Module' },
            { href: '/admin', label: 'Admin Access' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block font-mono text-white hover:bg-white/10 px-4 py-2"
            >
              {'>'}  {item.label}
            </Link>
          ))}
        </nav>

        {currentState?.activeThemes && (
          <Card variant="system" title="ACTIVE_PROCESSES">
            <div className="space-y-1 text-xs">
              {currentState.activeThemes.map((theme, i) => (
                <div key={theme}>process_{i}: {theme}</div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </aside>
  );
}