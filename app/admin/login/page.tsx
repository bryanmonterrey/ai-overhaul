'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (roleData?.role === 'admin') {
        router.push('/admin');
      } else {
        setError('Not authorized as admin');
        await supabase.auth.signOut();
      }
    } catch (error: any) {
      setError(error.message);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center p-4 bg-black">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center text-white">Admin Login</h1>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded bg-black text-white border-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-white">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded bg-black text-white border-white"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-black text-white rounded hover:bg-white/10 border border-white"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}