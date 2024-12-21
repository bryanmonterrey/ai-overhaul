// app/trading/hooks/useHolderTrading.ts
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { holderTradingService } from '../services/holderTradingService';

export function useHolderTrading(userAddress: string) {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    riskLevel: 'moderate',
    maxPositionSize: 0,
    tradingEnabled: false
  });
  const [portfolio, setPortfolio] = useState({
    totalValue: 0,
    positions: [],
    tokenBalance: 0
  });
  const [recentTrades, setRecentTrades] = useState([]);

  useEffect(() => {
    const subscription = holderTradingService.subscribeToUpdates(
      userAddress,
      (update) => {
        handleUpdate(update);
      }
    );

    return () => subscription.unsubscribe();
  }, [userAddress]);

  const handleUpdate = (update: any) => {
    switch (update.type) {
      case 'portfolio':
        setPortfolio(update.data);
        break;
      case 'trade':
        setRecentTrades(prev => [update.data, ...prev].slice(0, 50));
        break;
      case 'settings':
        setSettings(update.data);
        break;
    }
  };

  return {
    settings,
    portfolio,
    recentTrades,
    updateSettings: holderTradingService.updateSettings,
    toggleTrading: holderTradingService.toggleTrading
  };
}