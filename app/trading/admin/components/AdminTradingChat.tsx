// app/trading/admin/components/AdminTradingChat.tsx
'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';
import { ScrollArea } from '@base-ui-components/react/scroll-area';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Card } from '../../../components/common/Card';

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

      <ScrollArea.Root className="flex-1 p-4">
      <ScrollArea.Viewport className="h-full overscroll-contain rounded-md outline outline-1 -outline-offset-1 outline-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800" >
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
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="m-2 flex w-1 justify-center rounded bg-gray-200 opacity-0 transition-opacity delay-300 data-[hovering]:opacity-100 data-[hovering]:delay-0 data-[hovering]:duration-75 data-[scrolling]:opacity-100 data-[scrolling]:delay-0 data-[scrolling]:duration-75">
            <ScrollArea.Thumb className="w-full rounded bg-gray-500" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

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

