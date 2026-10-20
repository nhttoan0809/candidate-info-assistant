import { getEnv } from '@/lib/env';
import { GitHubClient } from '@/lib/github';
import { Workspace } from '@/components/workspace';
import type { Bootstrap } from '@/lib/types';
export const dynamic = 'force-dynamic';
export default async function Page() {
  let data: Bootstrap = {
    appName: 'Candidate Atlas',
    model: '',
    scope: '',
    profile: null,
    repositories: [],
  };
  try {
    const env = getEnv();
    data = {
      ...data,
      appName: env.APP_NAME,
      model: env.MODEL_NAME,
      scope: env.REPO_URL,
      candidateBio: env.CANDIDATE_BIO,
      owner: env.scope.owner,
    };
    const github = new GitHubClient();
    const [profile, repositories] = await Promise.all([github.profile(), github.repositories()]);
    data = { ...data, profile, repositories };
  } catch {
    data.githubError = 'Chưa đọc được hồ sơ. Kiểm tra cấu hình hoặc thử kết nối lại.';
  }
  return <Workspace initial={data} />;
}
