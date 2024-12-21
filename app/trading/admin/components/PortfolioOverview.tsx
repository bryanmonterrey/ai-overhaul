// app/trading/admin/components/PortfolioOverview.tsx
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PortfolioOverviewProps {
  data: {
    totalValue: number;
    dailyPnL: number;
    totalPnL: number;
    valueHistory: any[];
    metrics: {
      sharpeRatio: number;
      maxDrawdown: number;
      winRate: number;
    };
  };
}

export function PortfolioOverview({ data }: PortfolioOverviewProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <span className="text-sm text-muted-foreground">Total Value</span>
              <p className="text-2xl font-bold">{data.totalValue} SOL</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Daily P&L</span>
              <p className={`text-2xl font-bold ${
                data.dailyPnL >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {data.dailyPnL} SOL
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Total P&L</span>
              <p className={`text-2xl font-bold ${
                data.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {data.totalPnL} SOL
              </p>
            </div>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.valueHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
              <p className="text-2xl font-bold">{data.metrics.sharpeRatio.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Max Drawdown</span>
              <p className="text-2xl font-bold text-red-500">
                {data.metrics.maxDrawdown.toFixed(2)}%
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Win Rate</span>
              <p className="text-2xl font-bold">{data.metrics.winRate.toFixed(2)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}