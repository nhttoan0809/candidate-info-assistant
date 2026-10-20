import 'server-only';
import { z } from 'zod';
import { parseScope } from './scope';

const schema = z.object({
  MODEL_URL: z.url().refine((v) => ['http:', 'https:'].includes(new URL(v).protocol)),
  MODEL_NAME: z.string().min(1),
  MODEL_API_KEY: z.string().optional(),
  CLASSIFIER_MODEL_NAME: z.string().optional(),
  MODEL_REASONING_EFFORT: z
    .enum(['provider-default', 'none', 'low', 'medium', 'high'])
    .default('provider-default'),
  REPO_URL: z.string().min(1),
  GITHUB_TOKEN: z.string().optional(),
  APP_NAME: z.string().default('Candidate Atlas'),
  CANDIDATE_BIO: z.string().trim().max(2400).optional(),
  MODEL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(280000).default(240000),
  CLASSIFIER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(20000),
  GITHUB_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(12000),
  MAX_AGENT_STEPS: z.coerce.number().int().min(2).max(8).default(5),
  MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(12000).default(4096),
  MAX_REPOSITORIES: z.coerce.number().int().min(1).max(100).default(50),
  MAX_OVERVIEW_READMES: z.coerce.number().int().min(1).max(30).default(12),
  MAX_PROJECT_IMAGES: z.coerce.number().int().min(1).max(8).default(4),
  GITHUB_CACHE_SECONDS: z.coerce.number().int().min(0).max(3600).default(300),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});
export function getEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      `Cấu hình chưa hợp lệ: ${[...new Set(result.error.issues.map((i) => i.path[0]))].join(', ')}. Kiểm tra .env.local hoặc Vercel Environment Variables.`,
    );
  const env = result.data;
  const modelUrl = new URL(env.MODEL_URL);
  if (modelUrl.username || modelUrl.password || modelUrl.search || modelUrl.hash)
    throw new Error('MODEL_URL không được chứa thông tin đăng nhập hoặc query.');
  if (Boolean(env.UPSTASH_REDIS_REST_URL) !== Boolean(env.UPSTASH_REDIS_REST_TOKEN))
    throw new Error('Cần cả hai biến UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN.');
  return { ...env, MODEL_URL: env.MODEL_URL.replace(/\/$/, ''), scope: parseScope(env.REPO_URL) };
}
export type AppEnv = ReturnType<typeof getEnv>;
