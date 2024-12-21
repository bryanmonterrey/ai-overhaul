// app/trading/admin/page.tsx
import { redirect } from 'next/navigation';
import { AITradingDashboard } from './components/AITradingDashboard';
import { getUser } from '../../lib/auth';

export default async function AdminTradingPage() {
  const user = await getUser();

  if (!user?.isAdmin) {
    redirect('/');  // or wherever you want to redirect non-admins
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">AI Trading Management</h1>
      <AITradingDashboard />
    </div>
  );
}