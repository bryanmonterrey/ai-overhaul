// lib/middleware/rate-limiter.ts
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis, { RedisKey, RedisValue } from 'ioredis'
import { getRedisClient } from '../redis/client';

// Initialize Redis with proper type checking
const redis = getRedisClient();

export const authRateLimiter = rateLimit({
  store: redis ? new RedisStore({
    sendCommand: async (command: string, ...args: (string | number | Buffer)[]): Promise<any> => {
      return redis.call(command, ...args);
    }
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP/user to 100 requests per windowMs
  message: 'Too many auth requests'
});