import { RateLimiter } from '../../lib/utils/ai';

// Create separate limiters for different endpoints
const DEFAULT_RATE_LIMIT = {
  points: 300,  // requests per 15 minutes
  duration: 15 * 60 * 1000  // 15 minutes in milliseconds
};

const ENDPOINTS = {
  tweets: new RateLimiter(180, 15 * 60 * 1000),  // 180 requests per 15 minutes
  user: new RateLimiter(100, 15 * 60 * 1000),   // 100 requests per 15 minutes
  search: new RateLimiter(450, 15 * 60 * 1000), // 450 requests per 15 minutes
  default: new RateLimiter(
    DEFAULT_RATE_LIMIT.points, 
    DEFAULT_RATE_LIMIT.duration
  )
};

export async function checkTwitterRateLimit(endpoint?: keyof typeof ENDPOINTS) {
  const limiter = ENDPOINTS[endpoint] || ENDPOINTS.default;
  const canProceed = await limiter.checkLimit(`twitter:${endpoint || 'default'}`, 1);
  
  if (!canProceed) {
    const error = new Error('Twitter API rate limit exceeded. Please try again later.');
    error['code'] = 429;
    error['endpoint'] = endpoint;
    throw error;
  }
  
  return true;
}