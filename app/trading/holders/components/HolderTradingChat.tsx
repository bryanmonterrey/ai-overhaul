'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat, Message, UseChatHelpers } from 'ai/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from "@/hooks/use-toast";
import { holderTradingService } from '../../services/holderTradingService';
import InputMorphMessage from '@/components/InputMorphMessage';
import { solanaService } from '@/app/lib/solana';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { SignerWalletAdapterProps } from '@solana/wallet-adapter-base';
import bs58 from 'bs58';

interface TradeSession {
  publicKey: string;
  signature: string;
  timestamp: number;
  expiresAt: number;
}

interface TradeExecutionData {
  type: 'trade_execution';
  token: string;
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
}

interface TradingMessage extends Message {
  walletInfo?: {
    publicKey?: string;
    sessionSignature?: string;
    credentials?: {
      publicKey: string;
      signTransaction: boolean;
      signAllTransactions: boolean;
      connected: boolean;
    };
  };
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

// Helper functions
function isTradeExecution(data: any): data is TradeExecutionData {
return data?.type === 'trade_execution';
}

function isPortfolioUpdate(data: any): data is PortfolioUpdateData {
return data?.type === 'portfolio_update';
}

// Local storage session management - same as admin but with holder-specific key
const SESSION_KEY = 'holder_trading_session';

function getStoredSession(): TradeSession | null {
try {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  const parsed = JSON.parse(session);
  if (Date.now() > parsed.expiresAt) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return parsed;
} catch {
  return null;
}
}

function storeSession(session: TradeSession): void {
localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
localStorage.removeItem(SESSION_KEY);
}

export function HolderTradingChat({ userAddress }: { userAddress: string }) {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { publicKey, signTransaction, signAllTransactions, connected, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  
  // Initialize session state
  const [activeSession, setActiveSession] = useState<TradeSession | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  // Initialize session on wallet connection
  useEffect(() => {
    if (publicKey && connected && publicKey.toString() === userAddress) {
      const storedSession = getStoredSession();
      if (storedSession && storedSession.publicKey === publicKey.toString()) {
        setActiveSession(storedSession);
      }
    } else {
      setActiveSession(null);
      clearSession();
    }
  }, [publicKey, connected, userAddress]);

  // Update wallet connection
  useEffect(() => {
    if (publicKey && publicKey.toString() === userAddress) {
      solanaService.updateWalletConnection(publicKey);
    }
  }, [publicKey, userAddress]);

  // Auto-initialize wallet
  useEffect(() => {
    if (!connected && publicKey && publicKey.toString() === userAddress) {
      solanaService.updateWalletConnection(publicKey);
    }
  }, [connected, publicKey, userAddress]);

  // Initialize chat
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error
  }: UseChatHelpers = useChat({
    api: '/api/trading/holders/chat',
    streamProtocol: 'text',
    id: `holder-trading-chat-${userAddress}`,
    body: {
      walletInfo: publicKey ? {
        publicKey: publicKey.toString(),
        sessionSignature: activeSession?.signature,
        credentials: {
          publicKey: publicKey.toString(),
          signTransaction: !!signTransaction,
          signAllTransactions: !!signAllTransactions,
          connected
        }
      } : null,
      userAddress // Include the holder's address
    },
    onResponse: (response) => {
      console.log('Raw response:', response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    },
    onFinish: (message: TradingMessage) => {
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

  // Scroll effect
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Message monitoring effect
  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

  // Error handling effect
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
    const subscription = holderTradingService.subscribeToUpdates(userAddress, (update) => {
      if (update.type === 'trade_execution' || update.type === 'portfolio_update') {
        console.log('Received trading update:', update);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [userAddress]);

  // Handle session creation/refresh
  const initializeOrRefreshSession = async () => {
    try {
      setIsSessionLoading(true);
      if (!publicKey || !signMessage || publicKey.toString() !== userAddress) return null;

      const message = new TextEncoder().encode("authorize_holder_trading_session");
      const signature = await signMessage(message);

      const session: TradeSession = {
        publicKey: publicKey.toString(),
        signature: bs58.encode(signature),
        timestamp: Date.now(),
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };

      storeSession(session);
      setActiveSession(session);
      return session;
    } catch (error) {
      console.error('Session initialization error:', error);
      return null;
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleTradeExecution = async (tradeData: EnhancedTradeExecutionData) => {
    try {
      if (!publicKey || !signTransaction || !signAllTransactions || !connected || 
          publicKey.toString() !== userAddress) {
        toast({
          title: "Wallet Required",
          description: "Please connect your correct wallet to execute trades",
          variant: "destructive"
        });
        setVisible(true);
        return;
      }

      let session = activeSession;
      if (!session || Date.now() > session.expiresAt) {
        session = await initializeOrRefreshSession();
        if (!session) {
          throw new Error('Failed to initialize trading session');
        }
      }

      if (tradeData.requires_confirmation) {
        const confirmed = await confirmDialog({
          title: "Confirm Trade",
          message: `Please confirm your ${tradeData.side} order for ${tradeData.amount} ${tradeData.token}. ${tradeData.market_analysis?.recommendation || ''}`,
          confirmText: "Confirm Trade",
          cancelText: "Cancel"
        });
        
        if (!confirmed) return;
      }

      const result = await holderTradingService.executeHolderTrade({
        token: tradeData.token,
        side: tradeData.side,
        amount: tradeData.amount,
        price: tradeData.price,
        wallet: {
          publicKey,
          signTransaction,
          signAllTransactions,
          timestamp: Date.now()
        },
        userAddress
      });

      if (result.signature) {
        toast({
          title: "Trade Executed",
          description: `Successfully executed ${tradeData.side} trade for ${tradeData.amount} ${tradeData.token}`
        });
      }
    } catch (error) {
      console.error('Trade execution error:', error);
      toast({
        title: "Trade Failed",
        description: error instanceof Error ? error.message : "Failed to execute trade",
        variant: "destructive"
      });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (input.trim()) {
      try {
        const inputParts = input.trim().toLowerCase().split(' ');
        if (['buy', 'sell'].includes(inputParts[0]) && !activeSession) {
          const session = await initializeOrRefreshSession();
          if (!session) {
            throw new Error('Failed to initialize trading session');
          }
        }

        const tradeParams = {
          side: inputParts[0] as 'buy' | 'sell',
          amount: parseFloat(inputParts[1]),
          asset: inputParts[2]
        };

        const messageData = {
          content: input.trim(),
          walletInfo: publicKey ? {
            publicKey: publicKey.toString(),
            sessionSignature: activeSession?.signature,
            credentials: {
              publicKey: publicKey.toString(),
              signature: activeSession?.signature,
              signTransaction: !!signTransaction,
              signAllTransactions: !!signAllTransactions,
              connected
            }
          } : null,
          trade: {
            asset: tradeParams.asset,
            amount: tradeParams.amount,
            side: tradeParams.side
          },
          userAddress // Include holder's address
        };
  
        await handleSubmit(e, { 
          data: messageData as { [key: string]: any } 
        });
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

  const formattedMessages = (messages as TradingMessage[])
    .filter(msg => {
      if (!msg.content) return false;
      if (msg.content === '[DONE]') return false;
      return true;
    })
    .map((msg: TradingMessage, index) => {
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
        data: msg.data,
        walletInfo: msg.walletInfo
      };
    });

  const SessionStatus = () => (
    <div className="absolute top-4 right-4 flex items-center gap-2">
      {isSessionLoading ? (
        <span className="text-sm text-yellow-500">Connecting...</span>
      ) : activeSession ? (
        <span className="text-sm text-green-500">Connected</span>
      ) : (
        <span className="text-sm text-gray-400">Not connected</span>
      )}
    </div>
  );

  return (
    <Card className="w-full h-[600px] flex flex-col relative">
      <CardHeader>
        <CardTitle>Trading Assistant</CardTitle>
        <SessionStatus />
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <InputMorphMessage
            input={input}
            isLoading={isLoading || isSessionLoading}
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
