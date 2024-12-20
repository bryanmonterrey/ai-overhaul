// app/trading/admin/components/AdminTradingChat.tsx
'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export const AdminTradingChat = () => {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/admin/trading/chat',
  });

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">AI Trading Assistant</h2>
        <p className="text-sm text-muted-foreground">
          Control and monitor AI trading through conversation
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                {message.role === 'assistant' && message.data && (
                  <div className="mt-2 pt-2 border-t">
                    {/* Render trading data/actions */}
                    {message.data.type === 'trade_execution' && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold">Trade Details:</p>
                        <div className="text-xs">
                          <p>Token: {message.data.token}</p>
                          <p>Side: {message.data.side}</p>
                          <p>Amount: {message.data.amount} SOL</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleTradeExecution(message.data)}
                        >
                          Confirm Trade
                        </Button>
                      </div>
                    )}
                    {message.data.type === 'portfolio_update' && (
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
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-4">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about trades, performance, or give commands..."
            className="flex-1"
          />
          <Button type="submit">Send</Button>
        </div>
      </form>
    </Card>
  );
};

