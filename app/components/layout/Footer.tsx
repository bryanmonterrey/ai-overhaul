// src/app/components/layout/Footer.tsx

import React from 'react';

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-black border-t border-white py-2 px-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="font-mono text-xs text-white">
          <span className="mr-4">runtime: {process.uptime().toFixed(2)}s</span>
          <span>memory_usage: {(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}mb</span>
        </div>

        <div className="font-mono text-xs text-white">
          <span className="mr-4">status: [OPERATIONAL]</span>
          <span>version: 1.0.0-alpha</span>
        </div>

        <div className="font-mono text-xs text-white">
          system.datetime: {new Date().toISOString()}
        </div>
      </div>
    </footer>
  );
}