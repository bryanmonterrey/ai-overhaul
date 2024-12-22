// app/trading/admin/components/AdminTradingChat.tsx
'use client';

import { useRef, useEffect } from 'react';
import { useChat, Message } from 'ai/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from "@/hooks/use-toast";
import { aiTradingService } from '../../services/aiTradingService';

interface TradeExecutionData {
  type: 'trade_execution';
  token: string;
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
}

interface PortfolioUpdateData {
  type: 'portfolio_update';
  totalValue: number;
  dailyPnL: number;
}

type MessageData = TradeExecutionData | PortfolioUpdateData;

// Helper function to type check the message data
function isTradeExecution(data: any): data is TradeExecutionData {
  return data?.type === 'trade_execution';
}

function isPortfolioUpdate(data: any): data is PortfolioUpdateData {
  return data?.type === 'portfolio_update';
}

export function AdminTradingChat() {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/letta/chat',
    onResponse: (response) => {
      // Handle streaming response if needed
      console.log('Streaming response:', response);
    },
    onFinish: (message) => {
      // Handle completion if needed
      console.log('Chat completed:', message);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Subscribe to trading updates
  useEffect(() => {
    const subscription = aiTradingService.subscribeToUpdates((update) => {
      if (update.type === 'trade_execution' || update.type === 'portfolio_update') {
        console.log('Received trading update:', update);
        // Handle real-time updates if needed
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleTradeExecution = async (tradeData: TradeExecutionData) => {
    try {
      await aiTradingService.executeManualTrade({
        token: tradeData.token,
        side: tradeData.side,
        amount: tradeData.amount,
        price: tradeData.price
      });

      toast({
        title: "Trade Executed",
        description: `Successfully executed ${tradeData.side} trade for ${tradeData.amount} ${tradeData.token}`,
      });
    } catch (error) {
      console.error('Error executing trade:', error);
      toast({
        title: "Trade Failed",
        description: "Failed to execute trade. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>AI Trading Assistant</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        <ScrollArea ref={scrollRef} className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div className={`flex gap-3 max-w-[80%] ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={message.role === 'user' ? '/user-avatar.png' : '/ai-avatar.png'}
                      alt={message.role}
                    />
                    <AvatarFallback>
                      {message.role === 'user' ? 'U' : 'AI'}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.role === 'assistant' && message.data && (
                      <div className="mt-2 pt-2 border-t border-border">
                        {isTradeExecution(message.data) && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold">Trade Details:</p>
                            <div className="text-xs">
                              <p>Token: {message.data.token}</p>
                              <p>Side: {message.data.side}</p>
                              <p>Amount: {message.data.amount} SOL</p>
                              {message.data.price && (
                                <p>Price: {message.data.price} USDC</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => isTradeExecution(message.data) && handleTradeExecution(message.data)}
                              className="mt-2"
                            >
                              Confirm Trade
                            </Button>
                          </div>
                        )}
                        {isPortfolioUpdate(message.data) && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold">Portfolio Update:</p>
                            <div className="text-xs">
                              <p>Total Value: {message.data.totalValue} SOL</p>
                              <p>Daily P&L: {message.data.dailyPnL} SOL</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <span className="text-xs opacity-50 mt-1 block">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about trades, performance, or give commands..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}