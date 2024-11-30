import { RateLimiter } from '@/app/lib/utils/ai';

const rateLimiter = new RateLimiter(
  300,  // requests per 15 minutes
  15 * 60 * 1000  // 15 minutes in milliseconds
);

export async function checkTwitterRateLimit() {
  const canProceed = await rateLimiter.checkLimit('twitter', 1);
  if (!canProceed) {
    throw new Error('Twitter API rate limit exceeded. Please try again later.');
  }
} 