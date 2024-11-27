// app/api/token-validation/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { TokenChecker } from '@/app/lib/blockchain/token-checker';
import { Database } from '@/supabase/functions/supabase.types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
 try {
   // Parse request body
   const { walletAddress } = await req.json();
   console.log('1. Request received for wallet:', walletAddress);
   
   // Validate wallet address
   if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length !== 44) {
     return NextResponse.json(
       { error: 'Invalid wallet address format' },
       { status: 400 }
     );
   }

   // Initialize Supabase client with async cookie handling
   let cookieStore;
   try {
     cookieStore = await cookies();
     console.log('2. Cookie store initialized');
   } catch (e) {
     console.error('Error accessing cookies:', e);
     return NextResponse.json({ error: 'Cookie access error' }, { status: 500 });
   }

   const supabase = createRouteHandlerClient<Database>({
     cookies: async () => cookieStore
   });
   console.log('3. Supabase client created');

   // Verify session
   const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
   console.log('4. Session check result:', { 
     hasSession: !!sessionData?.session, 
     sessionError: sessionError?.message,
     userId: sessionData?.session?.user?.id
   });
   
   if (sessionError) {
     console.error('Session error:', sessionError);
     return NextResponse.json({ 
       error: 'Session error', 
       details: sessionError.message 
     }, { status: 401 });
   }

   const session = sessionData?.session;
   if (!session) {
     console.log('No active session found');
     return NextResponse.json({ error: 'No active session' }, { status: 401 });
   }

   // Initialize token checker
   const tokenChecker = new TokenChecker();
   
   try {
     console.log('5. Starting token balance and price check');
     const [balance, price] = await Promise.all([
       Promise.race([
         tokenChecker.getTokenBalance(walletAddress),
         new Promise<number>((_, reject) => 
           setTimeout(() => reject(new Error('Balance check timeout')), 10000)
         )
       ]),
       tokenChecker.getTokenPrice()
     ]);

     console.log('6. Token check results:', { balance, price });

     // Validate price
     if (price === 0) {
       console.warn('Warning: Token price returned as 0');
     }

     const value = balance * price;
     console.log('7. Calculated token value:', value);

     // Update token holdings with error handling
     const { error: upsertError } = await supabase
       .from('token_holders')
       .upsert({
         user_id: session.user.id,
         wallet_address: walletAddress,
         token_balance: balance,
         dollar_value: value,
         last_checked_at: new Date().toISOString()
       });

     if (upsertError) {
       console.error('8. Error updating token_holders:', upsertError);
     } else {
       console.log('8. Token holdings updated successfully');
     }

     // Get admin settings for eligibility
     const { data: settings, error: settingsError } = await supabase
       .from('admin_settings')
       .select('*');

     console.log('9. Admin settings fetched:', { settings, error: settingsError });

     if (settingsError) {
       console.error('Error fetching admin settings:', settingsError);
       // Use default value if settings can't be fetched
     }

     const requiredValue = settings?.find(s => s.key === 'required_token_value')?.value || 0;
     const isEligible = value >= requiredValue;

     console.log('10. Eligibility check:', {
       value,
       requiredValue,
       isEligible
     });

     // Return success response with all relevant data
     return NextResponse.json({
       success: true,
       isEligible,
       balance,
       value,
       price,
       requiredValue,
       walletAddress, // Include for verification
       timestamp: new Date().toISOString()
     });
   } catch (error: any) {
     if (error.message === 'Balance check timeout') {
       console.error('Token balance check timed out');
       return NextResponse.json(
         { error: 'Balance check timed out' },
         { status: 408 }
       );
     }
     
     // Log and rethrow other errors
     console.error('Token check error:', error);
     throw error;
   }
 } catch (error: any) {
   console.error('Error in token validation:', error);
   return NextResponse.json(
     { 
       error: 'Internal server error',
       details: error.message,
       timestamp: new Date().toISOString()
     },
     { status: 500 }
   );
 }
}