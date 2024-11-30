'use client';

import React, { useState, useEffect } from 'react';

export default function Footer() {
  const [uptime, setUptime] = useState(0);
  const [memory, setMemory] = useState(0);
  const [datetime, setDatetime] = useState('');

  useEffect(() => {
    const startTime = Date.now();
    
    // Update metrics every second
    const intervalId = setInterval(() => {
      // Update uptime
      setUptime((Date.now() - startTime) / 1000);
      
      // Update memory usage if available
      if (window.performance && window.performance.memory) {
        setMemory(window.performance.memory.usedJSHeapSize / (1024 * 1024));
      }
      
      // Update datetime
      setDatetime(new Date().toISOString());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-[#11111A] border-t border-[#DDDDDD] py-2 px-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="font-ia text-xs text-[#DDDDDD]">
          <span className="mr-4">runtime: {uptime.toFixed(2)}s</span>
          <span>memory_usage: {memory.toFixed(2)}mb</span>
        </div>

        <div className="font-ia text-xs text-[#DDDDDD]">
          <span className="mr-4">status: [OPERATIONAL]</span>
          <span>version: 1.0.0-alpha</span>
        </div>

        <div className="font-ia text-xs text-[#DDDDDD]">
          system.datetime: {datetime}
        </div>
      </div>
    </footer>
  );
}