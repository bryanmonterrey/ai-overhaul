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
import { solanaService } from '@/app/lib/solana';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { SignerWalletAdapterProps } from '@solana/wallet-adapter-base';


declare global {
  var walletCredentials: {
    publicKey: PublicKey;
    signTransaction: WalletContextState['signTransaction'];
    signAllTransactions: WalletContextState['signAllTransactions'];
    timestamp: number;
  } | undefined;
}

interface TradeExecutionData {
  type: 'trade_execution';
  token: string;
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
}

interface EnhancedTradeExecutionData extends TradeExecutionData {
    market_analysis?: {
      price_trend: string;
      volatility: number;
      recommendation?: string;
    };
    requires_confirmation?: boolean;
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
  const { publicKey, signTransaction, signAllTransactions, connected, select } = useWallet() as WalletContextState;
  const { setVisible } = useWalletModal();

  useEffect(() => {
    if (publicKey) {
      solanaService.updateWalletConnection(publicKey);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!connected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to continue",
        variant: "default",
      });
      setVisible(true);  // Show wallet modal
    }
  }, [connected, setVisible]);
  
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

  const handleTradeExecution = async (tradeData: EnhancedTradeExecutionData) => {
    try {
      // Check wallet connection and signing capabilities
      if (!publicKey || !signTransaction || !signAllTransactions || !connected) {
        toast({
          title: "Wallet Required",
          description: "Please connect your wallet with signing capabilities to execute trades",
          variant: "destructive"
        });
        setVisible(true);  // Show wallet modal
        return;
      }

      // Handle trade confirmation if required
      if (tradeData.requires_confirmation) {
        const confirmed = await confirmDialog({
          title: "Confirm High Risk Trade",
          message: `This trade has been flagged as high risk. ${tradeData.market_analysis?.recommendation || ''}`,
          confirmText: "Execute Trade",
          cancelText: "Cancel"
        });
        
        if (!confirmed) return;
      }

      // Cache wallet credentials if not already cached
      if (!global.walletCredentials) {
        global.walletCredentials = {
          publicKey,
          signTransaction,
          signAllTransactions,
          timestamp: Date.now()
        };
      }

      // Execute trade using cached credentials
      const result = await aiTradingService.executeManualTrade({
        token: tradeData.token,
        side: tradeData.side,
        amount: tradeData.amount,
        price: tradeData.price,
        wallet: global.walletCredentials
      });

      // Show market analysis if available
      if (tradeData.market_analysis) {
        toast({
          title: "Market Analysis",
          description: `Current trend: ${tradeData.market_analysis.price_trend}`,
          variant: "default"
        });
      }

      // Show success notification
      toast({
        title: "Trade Executed",
        description: `Successfully executed ${tradeData.side} trade for ${tradeData.amount} ${tradeData.token}`,
      });

    } catch (error) {
      // Clear credentials on error
      global.walletCredentials = undefined;
      
      console.error('Error executing trade:', error);
      toast({
        title: "Trade Failed",
        description: error instanceof Error ? error.message : "Failed to execute trade. Please try again.",
        variant: "destructive",
      });
    }
};

  useEffect(() => {
    // Subscribe to both trading updates and trade status
    const tradingSubscription = aiTradingService.subscribeToUpdates((update) => {
      if (update.type === 'trade_execution' || update.type === 'portfolio_update') {
        console.log('Received trading update:', update);
      }
    });
  
    const statusSubscription = aiTradingService.subscribeToTradeStatus((status) => {
      console.log('Trade status update:', status);
      // Handle different status updates
      switch(status.status) {
        case 'initiated':
          toast({
            title: "Trade Initiated",
            description: `Starting trade execution...`
          });
          break;
        case 'checking_route':
          toast({
            title: "Finding Best Route",
            description: "Checking available trading routes..."
          });
          break;
        case 'confirmed':
          toast({
            title: "Trade Confirmed",
            description: `Trade successfully executed!`
          });
          break;
        case 'error':
          toast({
            title: "Trade Error",
            description: status.error,
            variant: "destructive"
          });
          break;
      }
    });
  
    return () => {
      tradingSubscription.unsubscribe();
      statusSubscription.unsubscribe();
    };
  }, [toast]);


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

  const formattedMessages = messages
  .filter(msg => {
    if (!msg.content) return false;
    if (msg.content === '[DONE]') return false;
    return true;
  })
  .map((msg, index) => {
    let text = msg.content;
    
    if (text.startsWith('data: ')) {
      try {
        const jsonPart = text.split('\n')[0].slice(6);
        const parsed = JSON.parse(jsonPart);
        text = parsed.content;
      } catch {
        text = msg.content;
      }
    }

    return {
      id: index,
      text: text,
      role: msg.role === 'system' || msg.role === 'data' ? 'assistant' : msg.role,
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