// app/trading/hooks/useAITrading.ts
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast"
import { aiTradingService } from '../services/aiTradingService';

export function useAITrading() {
  const { toast } = useToast();
  const [tradingStatus, setTradingStatus] = useState('inactive');
  const [portfolio, setPortfolio] = useState({
    totalValue: 0,
    positions: [],
    pnl: {
      daily: 0,
      total: 0
    }
  });
  const [recentTrades, setRecentTrades] = useState([]);

  // Subscribe to real-time updates
  useEffect(() => {
    const subscription = aiTradingService.subscribeToUpdates((update) => {
      handleUpdate(update);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle different types of updates
  const handleUpdate = (update: any) => {
    switch (update.type) {
      case 'portfolio':
        setPortfolio(update.data);
        break;
      case 'trade':
        setRecentTrades(prev => [update.data, ...prev].slice(0, 50));
        break;
      case 'status':
        setTradingStatus(update.data.status);
        break;
    }
  };

  return {
    tradingStatus,
    portfolio,
    recentTrades,
    startTrading: aiTradingService.startTrading,
    stopTrading: aiTradingService.stopTrading,
    executeManualTrade: aiTradingService.executeManualTrade
  };
}