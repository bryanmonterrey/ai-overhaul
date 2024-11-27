import { cookies } from 'next/headers';

export function getAuthCookie() {
  const cookieStore = cookies();
  return {
    'sb-access-token': cookieStore.get('sb-access-token')?.value,
    'sb-refresh-token': cookieStore.get('sb-refresh-token')?.value
  };
}