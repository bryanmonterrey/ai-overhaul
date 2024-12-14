// app/components/MemoryTest.tsx
'use client';

import { useState } from 'react';
import { LettaClient } from '../lib/memory/letta-client';

export default function MemoryTest() {
  const lettaClient = new LettaClient();
  const [result, setResult] = useState<any>(null);

  const handleStoreMemory = async () => {
    try {
      const response = await lettaClient.getMemory('test_key', 'tweet_history');
      setResult(response);
    } catch (err) {
      console.error('Failed to store memory:', err);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Memory Test Component</h2>
      <button 
        onClick={handleStoreMemory}
        className="bg-blue-500 text-white px-4 py-2 rounded"
        disabled={loading}      
      >
        {loading ? 'Storing...' : 'Store Memory'}
      </button>
      
      {error && (
        <div className="text-red-500 mt-2">
          Error: {error}
        </div>
      )}
      
      {result && (
        <div className="mt-2">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}