// lib/websocket/trading.ts
import { createClient } from '@supabase/supabase-js';

export class TradingWebSocket {
  private supabase;
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async broadcastUpdate(
    channel: string,
    event: string,
    payload: any,
    userAddress?: string
  ) {
    try {
      let channelName = channel;
      if (userAddress) {
        channelName = `${channel}_${userAddress}`;
      }

      await this.supabase
        .channel(channelName)
        .send({
          type: 'broadcast',
          event: event,
          payload: payload
        });

    } catch (error) {
      console.error('WebSocket broadcast error:', error);
    }
  }
}

// Usage in LettA service:
const tradingWs = new TradingWebSocket();

// For AI trading updates
await tradingWs.broadcastUpdate(
  'admin_trading',
  'trading_update',
  {
    type: 'trade_execution',
    data: tradeResult
  }
);

// For holder updates
await tradingWs.broadcastUpdate(
  'holder_trading',
  'trading_update',
  {
    type: 'portfolio_update',
    data: portfolioData
  },
  userAddress
);