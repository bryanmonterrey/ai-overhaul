// app/trading/holders/components/HolderTradingChat.tsx
'use client';

export const HolderTradingChat = ({ userAddress }: { userAddress: string }) => {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/trading/holders/chat',
    body: {
      userAddress,
    },
  });

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">Trading Assistant</h2>
        <p className="text-sm text-muted-foreground">
          Chat with AI to manage your trading settings and view performance
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
                    {/* Render holder-specific data/actions */}
                    {message.data.type === 'settings_update' && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold">Update Settings:</p>
                        <div className="text-xs space-y-1">
                          <p>Risk Level: {message.data.riskLevel}</p>
                          <p>Max Position: {message.data.maxPosition} SOL</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSettingsUpdate(message.data)}
                        >
                          Apply Settings
                        </Button>
                      </div>
                    )}
                    {message.data.type === 'performance_update' && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold">Your Performance:</p>
                        <div className="text-xs">
                          <p>Portfolio Value: {message.data.portfolioValue} SOL</p>
                          <p>Token Balance: {message.data.tokenBalance}</p>
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
            placeholder="Ask about your portfolio, settings, or get trading advice..."
            className="flex-1"
          />
          <Button type="submit">Send</Button>
        </div>
      </form>
    </Card>
  );
};