import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// 3 submissions per IP per hour
export const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.slidingWindow(3, '24 h'),
  analytics: false,
  prefix: 'bcn_submit',
});
