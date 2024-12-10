// app/lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase.types';

// Client-side only
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