// lib/redis/client.ts
import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient() {
  if (!redis) {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is not defined');
    }

    redis = new Redis(
      process.env.REDIS_URL,
      {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 100, 3000);
        }
      }
    );
  }
  return redis;
}