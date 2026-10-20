import 'server-only';
import { createHash } from 'node:crypto';
import { getEnv } from './env';

const buckets = new Map<string, { count: number; reset: number }>();
export async function allowRequest(request: Request) {
  const env = getEnv();
  const ip =
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    'local';
  const key = createHash('sha256').update(ip).digest('hex').slice(0, 24);
  const minute = Math.floor(Date.now() / 60000);
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const response = await fetch(`${env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', `atlas:${key}:${minute}`],
        ['EXPIRE', `atlas:${key}:${minute}`, 65],
      ]),
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Bộ giới hạn truy cập tạm thời không khả dụng.');
    const result = await response.json();
    if (!Array.isArray(result) || typeof result[0]?.result !== 'number')
      throw new Error('Bộ giới hạn truy cập tạm thời không khả dụng.');
    return result[0].result <= 10;
  }
  const now = Date.now();
  if (buckets.size > 1000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + 60000 });
    return true;
  }
  return ++bucket.count <= 10;
}
