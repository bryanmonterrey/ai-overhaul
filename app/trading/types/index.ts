// app/trading/types/index.ts
export interface WebSocketMessage {
    type: 'trading_chat' | 'trading_chat_response' | 'trade_execution' | 'portfolio_update';
    text?: string;
    data?: any;
    messages?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    role?: 'admin' | 'user';
    userId?: string;
    context?: {
      isAdmin: boolean;
      sessionId: string;
    };
  }