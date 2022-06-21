import { redis } from '../src/handlers/redis.js';

await redis.flushall();