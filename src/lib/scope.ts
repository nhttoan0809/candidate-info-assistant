export interface RepoScope {
  owner: string;
  repo?: string;
}
const ownerPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;
const repoPattern = /^[a-zA-Z0-9_.-]{1,100}$/;

export function parseScope(raw: string): RepoScope {
  const url = new URL(raw);
  const segments = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    segments.length < 1 ||
    segments.length > 2 ||
    !ownerPattern.test(segments[0]) ||
    (segments[1] && (!repoPattern.test(segments[1]) || ['.', '..'].includes(segments[1])))
  ) {
    throw new Error(
      'REPO_URL phải là https://github.com/owner hoặc https://github.com/owner/repo.',
    );
  }
  return { owner: segments[0], repo: segments[1]?.replace(/\.git$/, '') };
}

export function assertRepo(scope: RepoScope, repo: string) {
  if (
    !repoPattern.test(repo) ||
    ['.', '..'].includes(repo) ||
    (scope.repo && repo.toLowerCase() !== scope.repo.toLowerCase())
  ) {
    throw new Error('Repo nằm ngoài phạm vi được cấu hình.');
  }
}

export function assertSafePath(path: string) {
  const parts = path.split('/');
  if (
    !path ||
    path.length > 300 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes('%') ||
    parts.some(
      (p) =>
        !p ||
        p === '..' ||
        p === '.' ||
        /^\.env(?:\.|$)/i.test(p) ||
        /^(?:\.git|\.npmrc|\.netrc|id_rsa|id_ed25519)$/i.test(p),
    ) ||
    /(?:^|\/)(?:credentials|secrets?)(?:\.|\/|$)|\.(?:pem|key|p12|pfx|pdf|png|jpe?g|gif|zip|mp4|woff2?)$/i.test(
      path,
    )
  ) {
    throw new Error('Chỉ đọc đường dẫn văn bản an toàn trong repo.');
  }
}
