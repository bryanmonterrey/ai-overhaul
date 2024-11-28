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
    setError(null); // Clear any previous errors
    
    try {
      // First attempt sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
  
      if (signInError) throw signInError;
      if (!signInData.user) throw new Error('No user returned from sign in');
  
      // Check admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', signInData.user.id)
        .maybeSingle();
  
      if (roleError) {
        console.error('Role check error:', roleError);
        await supabase.auth.signOut();
        throw new Error('Error verifying admin status');
      }
  
      if (!roleData || roleData.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('Not authorized as admin');
      }
  
      // Success - redirect to admin page
      router.push('/admin');
  
    } catch (error: any) {
      console.error('Login error:', error);
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