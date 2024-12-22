// app/trading/services/aiTradingService.ts
import { createClient } from '@supabase/supabase-js';

class AITradingService {
  private supabase;
  private baseUrl = '/api/admin/trading/chat';

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // WebSocket subscription for real-time updates
  subscribeToUpdates(callback: (update: any) => void) {
    const channel = this.supabase.channel('admin_trading')
      .on('broadcast', { event: 'trading_update' }, ({ payload }) => {
        callback(payload);
      })
      .subscribe();

    return {
      unsubscribe: () => {
        channel.unsubscribe();
      }
    };
  }

  // Trading Controls
  async startTrading() {
    const response = await fetch(`${this.baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to start trading');
    }

    return response.json();
  }

  async stopTrading() {
    const response = await fetch(`${this.baseUrl}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to stop trading');
    }

    return response.json();
  }

  // Manual Trade Execution
  async executeManualTrade(trade: {
    token: string;
    side: 'buy' | 'sell';
    amount: number;
    price?: number;
  }) {
    const response = await fetch(`${this.baseUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade)
    });

    if (!response.ok) {
      throw new Error('Failed to execute trade');
    }

    return response.json();
  }

  // Portfolio Management
  async getPortfolio() {
    const response = await fetch(`${this.baseUrl}/portfolio`);

    if (!response.ok) {
      throw new Error('Failed to fetch portfolio');
    }

    return response.json();
  }

  async updateStrategy(settings: {
    riskLevel: string;
    maxDrawdown: number;
    targetProfit: number;
  }) {
    const response = await fetch(`${this.baseUrl}/strategy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      throw new Error('Failed to update strategy');
    }

    return response.json();
  }

  // Risk Management
  async getPositionSizeRecommendation(token: string) {
    const response = await fetch(`${this.baseUrl}/position-size/${token}`);

    if (!response.ok) {
      throw new Error('Failed to get position size recommendation');
    }

    return response.json();
  }

  // Performance Analytics
  async getPerformanceMetrics(timeframe: string = '24h') {
    const response = await fetch(`${this.baseUrl}/metrics?timeframe=${timeframe}`);

    if (!response.ok) {
      throw new Error('Failed to fetch performance metrics');
    }

    return response.json();
  }
}

export const aiTradingService = new AITradingService();
