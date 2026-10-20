import 'server-only';
import { getEnv } from './env';
import { assertRepo, assertSafePath } from './scope';
import { selectProjectImages, type TreeEntry } from './project-images';
import type { CandidateProfile, Evidence, Repository } from './types';

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const cache = new Map<string, { value: unknown; expires: number }>();
interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  fork: boolean;
  stargazers_count: number;
  updated_at: string;
  default_branch: string;
  private: boolean;
}
interface Content {
  type: string;
  name: string;
  path: string;
  size: number;
  content?: string;
  encoding?: string;
  html_url: string;
}
interface PublicEvent {
  type: string;
  public: boolean;
  actor: { login: string };
  repo: { name: string };
  created_at: string;
}

export class GitHubClient {
  constructor(private signal?: AbortSignal) {}
  private env = getEnv();
  private get owner() {
    return encodeURIComponent(this.env.scope.owner);
  }
  private remember(path: string, value: unknown) {
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(path, { value, expires: Date.now() + this.env.GITHUB_CACHE_SECONDS * 1000 });
  }
  private async request<T>(path: string): Promise<T> {
    this.signal?.throwIfAborted();
    const key = path;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(this.env.GITHUB_TOKEN ? { Authorization: `Bearer ${this.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.any([
        ...(this.signal ? [this.signal] : []),
        AbortSignal.timeout(this.env.GITHUB_TIMEOUT_MS),
      ]),
      cache: 'no-store',
    });
    if (!response.ok) {
      const message =
        response.status === 404
          ? 'Không tìm thấy dữ liệu công khai trên GitHub.'
          : response.status === 403 || response.status === 429
            ? 'GitHub đang giới hạn truy cập. Thử lại sau hoặc cấu hình GITHUB_TOKEN.'
            : 'Không thể đọc GitHub lúc này. Vui lòng thử lại.';
      throw new GitHubError(message, response.status);
    }
    const value = (await response.json()) as T;
    this.remember(key, value);
    return value;
  }
  async profile(): Promise<CandidateProfile> {
    const d = await this.request<{
      login: string;
      name: string | null;
      avatar_url: string;
      html_url: string;
      bio: string | null;
      company: string | null;
      location: string | null;
      blog: string;
      public_repos: number;
      created_at: string;
    }>(`/users/${this.owner}`);
    return {
      login: d.login,
      name: d.name,
      avatar: d.avatar_url,
      url: d.html_url,
      bio: d.bio,
      company: d.company,
      location: d.location,
      blog: d.blog || null,
      publicRepos: d.public_repos,
      joined: d.created_at,
    };
  }
  private mapRepo(d: GitHubRepo): Repository {
    if (d.private) throw new Error('Chỉ sử dụng repo công khai.');
    if (d.full_name?.split('/')[0]?.toLowerCase() !== this.env.scope.owner.toLowerCase())
      throw new Error('Repo đã chuyển sang chủ sở hữu khác, ngoài phạm vi cấu hình.');
    assertRepo(this.env.scope, d.name);
    return {
      name: d.name,
      description: d.description,
      url: d.html_url,
      language: d.language,
      fork: d.fork,
      stars: d.stargazers_count,
      updated: d.updated_at,
      branch: d.default_branch,
    };
  }
  async repositories(): Promise<Repository[]> {
    if (this.env.scope.repo)
      return [
        this.mapRepo(
          await this.request<GitHubRepo>(
            `/repos/${this.owner}/${encodeURIComponent(this.env.scope.repo)}`,
          ),
        ),
      ];
    const repos: Repository[] = [];
    const limit = this.env.MAX_REPOSITORIES;
    for (let page = 1; repos.length < limit; page++) {
      const batch = await this.request<GitHubRepo[]>(
        `/users/${this.owner}/repos?per_page=${Math.min(100, limit)}&page=${page}&sort=updated&type=owner`,
      );
      repos.push(
        ...batch
          .filter((r) => !r.private)
          .map((r) => {
            const repository = this.mapRepo(r);
            // Reuse validated public metadata instead of requesting it again per README.
            this.remember(this.base(repository.name), r);
            return repository;
          }),
      );
      if (batch.length < Math.min(100, limit)) break;
    }
    return repos.slice(0, limit);
  }
  private base(repo: string) {
    assertRepo(this.env.scope, repo);
    return `/repos/${this.owner}/${encodeURIComponent(repo)}`;
  }
  async recentActivity(repositories: Repository[]) {
    // A single bounded sample, never a contribution calendar or employment history.
    const path = this.env.scope.repo
      ? `${this.base(this.env.scope.repo)}/events?per_page=30`
      : `/users/${this.owner}/events/public?per_page=30`;
    const events = await this.request<PublicEvent[]>(path);
    const inventory = new Map(
      repositories.map((repo) => {
        assertRepo(this.env.scope, repo.name);
        return [repo.name.toLowerCase(), repo];
      }),
    );
    const scoped = events.slice(0, 30).flatMap((event) => {
      const [owner, name, extra] = event.repo.name.split('/');
      const repo = inventory.get(name?.toLowerCase());
      if (
        !event.public ||
        extra ||
        owner.toLowerCase() !== this.env.scope.owner.toLowerCase() ||
        event.actor.login.toLowerCase() !== this.env.scope.owner.toLowerCase() ||
        !repo
      )
        return [];
      return [
        {
          type: event.type,
          repository: repo.name,
          fork: repo.fork,
          date: event.created_at,
          url: repo.url,
        },
      ];
    });
    return {
      status: 'available' as const,
      events: scoped.slice(0, 8),
      matched: scoped.length,
      sampled: Math.min(events.length, 30),
      note: 'Mẫu tối đa 30 sự kiện công khai gần đây, chỉ của tài khoản trong phạm vi repo đã lấy; gửi tối đa 8 sự kiện phù hợp gần nhất để tóm tắt. API có độ trễ và lịch sử giới hạn; không phải toàn bộ đóng góp. Không có sự kiện không có nghĩa là không hoạt động. updated_at của repo không chứng minh tác giả commit hay lịch sử làm việc.',
      source: {
        id: 'public-activity',
        title: 'Hoạt động GitHub công khai',
        url: `https://api.github.com${path}`,
        kind: 'activity' as const,
      },
    };
  }
  async overviewReadme(repo: string, characterLimit = 2000) {
    const base = this.base(repo);
    const repository = this.mapRepo(await this.request<GitHubRepo>(base));
    if (repository.fork) return { repository: repo, status: 'fork' as const, text: null };
    const readme = await this.request<Content>(`${base}/readme`).catch((error) => {
      if (error instanceof GitHubError && error.status === 404) return null;
      throw error;
    });
    if (!readme) return { repository: repo, status: 'missing' as const, text: null };
    assertSafePath(readme.path);
    if (
      !/(^|\/)readme\.md$/i.test(readme.path) ||
      readme.type !== 'file' ||
      readme.encoding !== 'base64' ||
      readme.size > 100000
    )
      return { repository: repo, status: 'unsupported' as const, text: null };
    const decoded = Buffer.from(readme.content || '', 'base64').toString('utf8');
    if (decoded.includes('\u0000') || decoded.includes('\ufffd'))
      return { repository: repo, status: 'unsupported' as const, text: null };
    // Compact the document locally; never fetch Markdown links or image URLs.
    const compact = decoded
      .replace(/```[\s\S]*?```/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const limit = Math.max(1, Math.min(2000, characterLimit));
    const technologyLines = compact
      .split('\n')
      .filter((line) =>
        /react|typescript|javascript|node\.?js|python|fastapi|express|mongo|firebase|mediapipe|yolo|playwright|esp32|platformio|websocket|three\.js|tailwind/i.test(
          line,
        ),
      );
    const introLimit = Math.floor(limit * 0.6);
    const excerpt =
      compact.length <= limit
        ? compact
        : compact.slice(0, introLimit) +
          '\n[…]\n' +
          technologyLines.join('\n').slice(0, Math.max(0, limit - introLimit - 5));
    return {
      repository: repo,
      status: 'read' as const,
      text: excerpt.slice(0, limit),
      truncated: compact.length > limit,
      source: {
        id: `${repo}/readme`,
        title: `${repo} / ${readme.path}`,
        url: readme.html_url,
        kind: 'file' as const,
      },
    };
  }
  async projectImages(repo: string) {
    const base = this.base(repo);
    const metadata = this.mapRepo(await this.request<GitHubRepo>(base));
    const [branch, readme] = await Promise.all([
      this.request<{ commit: { sha: string } }>(
        `${base}/branches/${encodeURIComponent(metadata.branch)}`,
      ),
      this.request<Content>(`${base}/readme`).catch((e) => {
        if (e instanceof GitHubError && e.status === 404) return null;
        throw e;
      }),
    ]);
    const tree = await this.request<{ tree: TreeEntry[]; truncated: boolean }>(
      `${base}/git/trees/${branch.commit.sha}?recursive=1`,
    );
    const images = selectProjectImages({
      owner: this.env.scope.owner,
      repo,
      branch: metadata.branch,
      commit: branch.commit.sha,
      tree: tree.tree.slice(0, 20000),
      readme: readme?.content
        ? Buffer.from(readme.content, 'base64').toString('utf8').slice(0, 60000)
        : '',
      readmePath: readme?.path || 'README.md',
      limit: this.env.MAX_PROJECT_IMAGES,
    }).map((img) => ({ ...img, fork: metadata.fork }));
    return {
      repository: repo,
      images,
      incomplete: tree.truncated || tree.tree.length > 20000,
      note: images.length
        ? 'Ảnh thật được tham chiếu trong README hoặc thư mục screenshot của repo. Chưa phân tích nội dung pixel.'
        : 'Chưa tìm thấy ảnh dự án phù hợp trong README hoặc các file screenshot đã duyệt. Không tự tạo ảnh thay thế.',
      sources: [
        { id: repo, title: repo, url: metadata.url, kind: 'repository' as const },
        ...(readme
          ? [
              {
                id: `${repo}/readme`,
                title: `${repo} / ${readme.name || 'README'}`,
                url: readme.html_url,
                kind: 'file' as const,
              },
            ]
          : []),
        ...images.map((img) => ({
          id: img.id,
          title: `${repo} / ${img.path}`,
          url: img.sourceUrl,
          kind: 'file' as const,
        })),
      ],
    };
  }
  async readFile(repo: string, path: string) {
    assertSafePath(path);
    this.mapRepo(await this.request<GitHubRepo>(this.base(repo)));
    const d = await this.request<Content>(
      `${this.base(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,
    );
    if (d.type !== 'file' || d.encoding !== 'base64' || d.size > 100000)
      throw new Error('File không phải văn bản nhỏ hơn 100 KB.');
    const text = Buffer.from(d.content || '', 'base64').toString('utf8');
    if (text.includes('\u0000') || text.includes('\ufffd'))
      throw new Error('Không đọc nội dung nhị phân.');
    return {
      path,
      text: text.slice(0, 12000),
      truncated: text.length > 12000,
      source: {
        id: `${repo}/${path}`,
        title: `${repo} / ${path}`,
        url: d.html_url,
        kind: 'file' as const,
      },
    };
  }
  async inspect(repo: string) {
    const base = this.base(repo);
    const metadata = this.mapRepo(await this.request<GitHubRepo>(base));
    const [languages, root, readme] = await Promise.all([
      this.request<Record<string, number>>(`${base}/languages`),
      this.request<Content[]>(`${base}/contents/`),
      this.request<Content>(`${base}/readme`).catch((e) => {
        if (e instanceof GitHubError && e.status === 404) return null;
        throw e;
      }),
    ]);
    const readmeText = readme?.content
      ? Buffer.from(readme.content, 'base64').toString('utf8').slice(0, 8000)
      : null;
    const manifest = root.find((f) => f.name === 'package.json' && f.type === 'file');
    let dependencies: unknown = null;
    if (manifest) {
      const file = await this.readFile(repo, manifest.path);
      try {
        const pkg = JSON.parse(file.text);
        dependencies = { dependencies: pkg.dependencies, devDependencies: pkg.devDependencies };
      } catch {
        /* malformed or truncated manifest */
      }
    }
    const sources: Evidence[] = [{ id: repo, title: repo, url: metadata.url, kind: 'repository' }];
    if (readme)
      sources.push({
        id: `${repo}/readme`,
        title: `${repo} / ${readme.name}`,
        url: readme.html_url,
        kind: 'file',
      });
    if (manifest)
      sources.push({
        id: `${repo}/package.json`,
        title: `${repo} / package.json`,
        url: manifest.html_url,
        kind: 'file',
      });
    return {
      repository: metadata,
      languages,
      files: root.slice(0, 50).map((f) => ({ path: f.path, type: f.type })),
      readme: readmeText,
      dependencies,
      sources,
    };
  }
}
