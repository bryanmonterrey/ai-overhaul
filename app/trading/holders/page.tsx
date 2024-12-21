// app/trading/holders/page.tsx
import { redirect } from 'next/navigation';
import { HolderDashboard } from './components/HolderDashboard';
import { getUser, verifyTokenHolder } from '../../lib/auth'; 

export default async function HolderTradingPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  // Verify token holder status
  const isHolder = await verifyTokenHolder(user.walletAddress);
  if (!isHolder) {
    redirect('/token/buy'); // Redirect to token purchase page
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Holder Trading Dashboard</h1>
      <HolderDashboard userAddress={user.walletAddress} />
    </div>
  );
}