'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || 'your-site-key';

  useEffect(() => {
    // Test connection to the database (for debugging purposes)
    const testConnection = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('count(*)')
          .single();
        console.log('Connection test:', { data, error });
      } catch (err) {
        console.error('Connection test failed:', err);
      }
    };

    testConnection();
  }, [supabase]);

  const handleCaptchaVerify = (token: string) => {
    console.log('Captcha verified:', token);
    setCaptchaToken(token);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!captchaToken) {
      setError('Please complete the CAPTCHA.');
      return;
    }

    try {
      // Step 1: Verify CAPTCHA server-side
      const captchaResponse = await fetch('/api/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: captchaToken }),
      });

      const captchaResult = await captchaResponse.json();

      if (!captchaResult.success) {
        console.error('CAPTCHA verification failed:', captchaResult.errors);
        throw new Error('CAPTCHA verification failed.');
      }

      console.log('CAPTCHA verification passed!');

      // Step 2: Sign in using Supabase
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Sign-In Error:', signInError);
        throw new Error(`Sign in failed: ${signInError.message}`);
      }

      if (!signInData.user) {
        throw new Error('No user data returned from Supabase.');
      }

      console.log('Sign-In Successful:', signInData);

      // Step 3: Check user role in Supabase database
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', signInData.user.id)
        .single();

      if (roleError) {
        console.error('Role Check Error:', roleError);
        await supabase.auth.signOut();
        throw new Error(`Role check failed: ${roleError.message}`);
      }

      if (!roleData || roleData.role !== 'admin') {
        console.error('Unauthorized Role:', roleData);
        await supabase.auth.signOut();
        throw new Error('Not authorized as admin.');
      }

      console.log('Admin Role Verified:', roleData);

      // Step 4: Redirect to admin dashboard
      router.push('/admin');
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'An unknown error occurred.');
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center p-2 bg-[#11111A]">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-center text-zinc-50">Admin Login</h1>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-none">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-50">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded-md bg-[#11111A] text-zinc-50 border-zinc-800"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-50">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded-md bg-[#11111A] text-zinc-50 border-zinc-800"
              required
            />
          </div>
          <div className="mt-4">
            <Turnstile
              siteKey={turnstileSiteKey}
              onSuccess={handleCaptchaVerify}
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 bg-[#0D0E15] text-zinc-50 rounded-md hover:bg-white/10 border border-zinc-800"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
