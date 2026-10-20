import { getEnv } from '@/lib/env';
import { GitHubClient } from '@/lib/github';
import type { Bootstrap } from '@/lib/types';
export async function GET(request: Request) {
  try {
    const env = getEnv();
    const github = new GitHubClient(request.signal);
    const [profile, repositories] = await Promise.all([github.profile(), github.repositories()]);
    return Response.json({
      appName: env.APP_NAME,
      model: env.MODEL_NAME,
      scope: env.REPO_URL,
      profile,
      repositories,
      candidateBio: env.CANDIDATE_BIO,
      owner: env.scope.owner,
    } satisfies Bootstrap);
  } catch {
    return Response.json(
      { error: 'Chưa đọc được hồ sơ. Kiểm tra REPO_URL, kết nối GitHub và hạn mức API.' },
      { status: 503 },
    );
  }
}
