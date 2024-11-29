// src/app/components/personality/Chat.tsx

'use client';
 
import React, { useState, useEffect, useCallback } from 'react';
import { PersonalityState as ImportedPersonalityState } from '../../core/types';
import { AIResponse } from '../../core/types/ai';
import { TokenCounter } from '../../lib/utils/ai';
import { AIError, AIRateLimitError } from '../../core/errors/AIError';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/common/Alert';
import { ChatLogger } from '@/app/lib/logging/chat';
import { Message } from '@/app/core/types/chat';
import { dbService } from '@/app/lib/services/database';
import { qualityMetricsService } from '@/app/lib/services/quality-metrics';
import { trainingDataService } from '@/app/lib/services/training';
import { QualityMetricsDisplay } from '../analytics/QualityMetricsDisplay';
import { ChatAnalytics } from '@/app/components/analytics/ChatAnalytics';

interface ChatMetrics {
  coherence: number;
  emotionalAlignment: number;
  narrativeConsistency: number;
  responseRelevance: number;
  overall: number;
}

interface ChatProps {
  personalityState: ImportedPersonalityState;
  onPersonalityStateChange: (state: Partial<ImportedPersonalityState>) => void;
}

export default function Chat({ personalityState: externalState, onPersonalityStateChange }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [internalState, setInternalState] = useState<ImportedPersonalityState | null>(externalState);
  const [personalityState, setPersonalityState] = useState<ImportedPersonalityState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [chatLogger] = useState(() => new ChatLogger('chat'));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<ChatMetrics | null>(null);

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      // Check authentication first
      const response = await fetch('/api/auth/check', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Authentication required');
      }

      const newSessionId = await dbService.startSession('chat');
      console.log('Chat session initialized:', newSessionId);
      setSessionId(newSessionId);
    } catch (error: any) {
      console.error('Failed to initialize session:', error?.message || error);
      // Redirect to login if not authenticated
      if (error?.message === 'Authentication required') {
        window.location.href = '/login';
        return;
      }
      setError({
        message: 'Failed to start chat session',
        retryable: true
      });
    }
  };

  const calculateMetrics = useCallback((message: Message) => {
    if (!personalityState || messages.length === 0) return null;
    
    return qualityMetricsService.calculateMetrics(
      message,
      messages,
      personalityState
    );
  }, [messages, personalityState]);

  const handleError = (error: unknown) => {
    if (error instanceof AIRateLimitError) {
      return {
        message: `Rate limit exceeded. Please wait ${error.retryAfter || 'a moment'} before trying again.`,
        retryable: true
      };
    }
    if (error instanceof AIError) {
      return {
        message: error.message,
        retryable: error.retryable
      };
    }
    return {
      message: 'An unexpected error occurred',
      retryable: false
    };
  };

  const sendMessage = async (retry = false, retryMessageId?: string) => {
    const startTime = performance.now();
    if (!inputText.trim() && !retry) return;

    setIsLoading(true);
    setError(null);

    const messageText = retry ? messages.find(m => m.id === retryMessageId)?.content || '' : inputText;
    const messageId = Math.random().toString();

    if (!retry) {
      const newMessage: Message = {
        id: messageId,
        content: messageText,
        sender: 'user',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      setInputText('');
      
      if (sessionId) {
        await dbService.logMessage(newMessage, sessionId, {});
      }
    }

    try {
      // Estimate tokens before sending
      const estimatedTokens = await TokenCounter.estimateTokenCount(messageText, 'anthropic');
      setTokenCount(prev => prev + estimatedTokens);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          personality: personalityState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new AIError(
          errorData.error || 'Failed to send message',
          errorData.code || 'UNKNOWN_ERROR',
          response.status,
          errorData.retryable
        );
      }

      const data = await response.json();
      const responseTime = performance.now() - startTime;

      let aiMessage: Message;
      if (retry && retryMessageId) {
        aiMessage = {
          id: retryMessageId,
          error: false,
          retryable: false,
          content: data.response,
          sender: 'ai',
          timestamp: new Date(),
          emotionalState: data.emotionalState,
          aiResponse: data.aiResponse
        };
        
        setMessages(prev => prev.map(msg => 
          msg.id === retryMessageId ? aiMessage : msg
        ));
      } else {
        aiMessage = {
          id: Math.random().toString(),
          content: data.response,
          sender: 'ai',
          timestamp: new Date(),
          emotionalState: data.emotionalState,
          aiResponse: data.aiResponse
        };

        setMessages(prev => [...prev, aiMessage]);
      }

      // Calculate and update metrics
      const metrics = calculateMetrics(aiMessage);
      setCurrentMetrics(metrics);

      // Log message with metrics
      if (sessionId && metrics) {
        await dbService.logMessage(aiMessage, sessionId, {
          responseTime,
          qualityScore: metrics.overall,
          tokenCount: data.aiResponse.tokenCount.total
        });
      }

      // Collect training data if quality is good
      if (personalityState) {
        await trainingDataService.collectTrainingData(
          [...messages, aiMessage],
          personalityState
        );
      }

      setPersonalityState(data.personalityState);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorInfo = handleError(error);
      setError(errorInfo);
      
      const errorMessage: Message = {
        id: Math.random().toString(),
        content: errorInfo.message,
        sender: 'ai',
        timestamp: new Date(),
        emotionalState: 'error',
        error: true,
        retryable: errorInfo.retryable
      };

      setMessages(prev => [...prev, errorMessage]);

      if (sessionId) {
        await dbService.logMessage(errorMessage, sessionId, {
          responseTime: performance.now() - startTime,
          qualityScore: 0
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const retryMessage = (messageId: string) => {
    sendMessage(true, messageId);
  };

  useEffect(() => {
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [messages]);

  // End session when component unmounts
  useEffect(() => {
    return () => {
      if (sessionId) {
        dbService.endSession(sessionId);
      }
    };
  }, [sessionId]);

  return (
    <div className="flex h-[calc(100vh-15rem)] max-w-6xl mx-auto">
      <div className="flex-1 flex flex-col">
        {error && (
          <Alert variant="error" className="m-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        
        <div id="chat-messages" className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-4 rounded-none ${
                message.sender === 'user'
                  ? 'bg-[#11111A] border border-white ml-auto'
                  : message.error
                  ? 'bg-[#11111A] border border-white'
                  : 'bg-[#11111A] border border-white'
              } max-w-[80%]`}
            >
              {message.sender === 'ai' && (
                <div className={`text-xs mb-1 ${
                  message.error ? 'text-white' : 'text-white'
                }`}>
                  {`[${new Date(message.timestamp).toLocaleTimeString()}] ${
                    message.emotionalState ? `STATE: ${message.emotionalState}` : ''
                  }`}
                </div>
              )}
              <div className={message.sender === 'ai' ? 'font-mono' : ''}>
                {message.content}
              </div>
              {message.aiResponse && !message.error && (
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <p>Model: {message.aiResponse.model}</p>
                  <p>Tokens: {message.aiResponse.tokenCount.total}</p>
                  {message.aiResponse.cached && <p>Cached Response</p>}
                </div>
              )}
              {message.error && message.retryable && (
                <button
                  onClick={() => retryMessage(message.id)}
                  className="mt-2 text-xs text-white hover:text-white font-mono"
                >
                  [RETRY_MESSAGE]
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-white p-4 bg-[#11111A]">
          <div className="text-xs text-white mb-2">
            TOKEN_COUNT: {tokenCount}
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
              className="flex-1 bg-[#11111A] text-white border border-white rounded-none px-4 py-2 font-mono disabled:opacity-50"
              placeholder={isLoading ? 'PROCESSING...' : 'ENTER_COMMAND...'}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !inputText.trim()}
              className="bg-[#11111A] text-white px-4 py-2 rounded-none font-mono border border-white disabled:opacity-50 hover:bg-[#11111A] transition-colors"
            >
              {isLoading ? 'PROCESSING...' : 'EXECUTE'}
            </button>
          </div>
        </div>
      </div>

      <div className="w-80 border-l border-white p-4 space-y-4">
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="w-full text-white border border-white p-2 font-mono text-sm"
        >
          {showAnalytics ? '[HIDE_ANALYTICS]' : '[SHOW_ANALYTICS]'}
        </button>

        {currentMetrics && (
          <QualityMetricsDisplay metrics={currentMetrics} />
        )}

        {showAnalytics && sessionId && (
          <ChatAnalytics />
        )}
      </div>
    </div>
  );
}