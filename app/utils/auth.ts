// app/utils/auth.ts
import { cookies } from 'next/headers';

export async function getAuthCookie() {
  const cookieStore = await cookies();
  return {
    'auth-token': cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token')?.value,
    'refresh-token': cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token.0')?.value
  };
}

export async function validateSession() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token')?.value;
  
  if (!authToken) {
    return {
      isValid: false,
      error: 'No auth token found'
    };
  }

  return {
    isValid: true,
    token: authToken
  };
}

export async function getSupabaseCookies() {
  const cookieStore = await cookies();
  const cookies = {
    'sb-access-token': cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token')?.value,
    'sb-refresh-token': cookieStore.get('sb-dbavznzqcwnwxsgfbsxw-auth-token.0')?.value,
  };

  return cookies;
}