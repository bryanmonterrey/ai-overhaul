// lib/middleware/rate-limiter.ts
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis from 'ioredis'

// Initialize Redis with proper type checking
const redis = process.env.REDIS_URL ? new Redis({
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: 3
}) : null;

export const authRateLimiter = rateLimit({
  store: redis ? new RedisStore({
    // Fixed the spread operator issue by explicitly defining the sendCommand
    sendCommand: async (command: string, args: unknown[]) => {
      return redis.call(command, ...args);
    }
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP/user to 100 requests per windowMs
  message: 'Too many auth requests'
});