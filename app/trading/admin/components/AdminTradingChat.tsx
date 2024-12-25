'use client';

import { useRef, useEffect } from 'react';
import { useChat, Message } from 'ai/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from "@/hooks/use-toast";
import { aiTradingService } from '../../services/aiTradingService';
import InputMorphMessage from '@/components/InputMorphMessage';

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
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/trading/admin/chat',
    streamProtocol: 'text',
    id: 'admin-trading-chat',
    onResponse: (response) => {
      console.log('Raw response:', response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    },
    onFinish: (message) => {
      console.log('Chat completed:', message);
      scrollToBottom();
    },
    onError: (error) => {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process message",
        variant: "destructive",
      });
    }
  });

  // Scroll helper function
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Effect for scrolling
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Effect for monitoring messages
  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

  // Effect for error handling
  useEffect(() => {
    if (error) {
      console.error('Chat error state:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Subscribe to trading updates
  useEffect(() => {
    const subscription = aiTradingService.subscribeToUpdates((update) => {
      if (update.type === 'trade_execution' || update.type === 'portfolio_update') {
        console.log('Received trading update:', update);
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

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (input.trim()) {
      try {
        await handleSubmit(e);
      } catch (error) {
        console.error('Form submission error:', error);
        toast({
          title: "Message Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Format messages for InputMorphMessage, filtering out [DONE] and data: prefixes
  const formattedMessages = messages
  .filter(msg => {
    // Filter out [DONE] messages and empty messages
    if (!msg.content || msg.content === '[DONE]') return false;
    return true;
  })
  .map((msg, index) => {
    let content = msg.content;
    // If content is a JSON string starting with "data: ", parse it
    if (typeof content === 'string' && content.startsWith('data: ')) {
      try {
        const jsonContent = JSON.parse(content.slice(6));
        content = jsonContent.content;
      } catch {
        // If parsing fails, just use the content as is
        content = content.slice(6);
      }
    }

    return {
      id: index,
      text: content,
      role: msg.role as 'user' | 'assistant',
      data: msg.data
    };
  });

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>AI Trading Assistant</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <InputMorphMessage
            input={input}
            isLoading={isLoading}
            onInputChange={handleInputChange}
            onFormSubmit={handleFormSubmit}
            messages={formattedMessages}
            handleTradeExecution={handleTradeExecution}
          />
        </div>
      </CardContent>
    </Card>
  );
}