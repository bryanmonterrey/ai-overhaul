// app/lib/supabase/client.ts
import { createRouteHandlerClient, createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';

export function getSupabaseClient() {
    const cookieStore = cookies();
    return createRouteHandlerClient<Database>({ 
        cookies: () => cookieStore
    });
}

// Separate client for components with cookie options
export function createClient() {
    return createClientComponentClient<Database>({
        cookieOptions: {
            name: 'sb-auth-token',
            domain: 'terminal.goatse.app',
            path: '/',
            secure: true,
            sameSite: 'lax'
        }
    });
}