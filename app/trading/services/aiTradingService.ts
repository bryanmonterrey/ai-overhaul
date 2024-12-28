// app/trading/services/aiTradingService.ts
import { createClient } from '@supabase/supabase-js';
import { solanaService } from '../../lib/solana';

class AITradingService {
  private supabase;
  private baseUrl = '/api/admin/trading/chat';
  private ws: WebSocket | null = null;
  private tradeStatusCallbacks: Set<(status: any) => void> = new Set();

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
    try {
      // Get market data first
      const [priceData, tokenData] = await Promise.all([
        solanaService.pythFetchPrice(trade.token),
        solanaService.getTokenData(trade.token)
      ]);

      // Execute trade through your backend
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...trade,
          priceData,
          tokenData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to execute trade');
      }

      const result = await response.json();

      const tradeStatusPromise = new Promise((resolve, reject) => {
        const subscription = this.subscribeToTradeStatus((status) => {
          if (status.trade_id === result.trade_id) {
            if (status.status === 'confirmed') {
              subscription.unsubscribe();
              resolve(status);
            } else if (status.status === 'error') {
              subscription.unsubscribe();
              reject(new Error(status.error));
            }
          }
        });
      });

      // Broadcast update
      this.supabase.channel('admin_trading')
        .send({
          type: 'broadcast',
          event: 'trading_update',
          payload: {
            type: 'trade_execution',
            ...trade,
            result
          }
        });
        

      return result;
    } catch (error) {
      console.error('Trade execution error:', error);
      throw error;
    }
  }

  subscribeToTradeStatus(callback: (status: any) => void) {
    // Add callback to set
    this.tradeStatusCallbacks.add(callback);

    // Initialize WebSocket if not already done
    if (!this.ws) {
      this.ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws/trading');
      
      this.ws.onmessage = (event) => {
        const update = JSON.parse(event.data);
        
        if (update.type === 'trade_status') {
          // Notify all callbacks
          this.tradeStatusCallbacks.forEach(cb => cb(update.data));
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        // Attempt to reconnect after a delay
        setTimeout(() => this.reconnectWebSocket(), 5000);
      };
    }

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.tradeStatusCallbacks.delete(callback);
        if (this.tradeStatusCallbacks.size === 0) {
          this.ws?.close();
          this.ws = null;
        }
      }
    };
  }

  private reconnectWebSocket() {
    if (this.tradeStatusCallbacks.size > 0) {
      this.ws = null;
      this.subscribeToTradeStatus(Array.from(this.tradeStatusCallbacks)[0]);
    }
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
