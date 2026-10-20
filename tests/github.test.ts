import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from '../src/lib/github';
beforeEach(() => {
  vi.stubEnv('MODEL_URL', 'http://localhost:11434/v1');
  vi.stubEnv('MODEL_NAME', 'test');
  vi.stubEnv('REPO_URL', 'https://github.com/test-scope-owner/single');
  vi.stubEnv('GITHUB_CACHE_SECONDS', '0');
});
describe('GitHub retrieval', () => {
  it('does not contact the network for an out-of-scope repo', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await expect(new GitHubClient().inspect('outside')).rejects.toThrow('phạm vi');
    await expect(new GitHubClient().projectImages('outside')).rejects.toThrow('phạm vi');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects private data even when a token can access it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ private: true }));
    await expect(new GitHubClient().readFile('single', 'README.md')).rejects.toThrow('công khai');
    await expect(new GitHubClient().projectImages('single')).rejects.toThrow('công khai');
  });
  it('discovers a public image through scoped metadata, branch commit and verified tree', async () => {
    const sha = 'b'.repeat(40);
    const urls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/branches/')) return Response.json({ commit: { sha } });
      if (url.includes('/git/trees/'))
        return Response.json({
          truncated: false,
          tree: [{ path: 'screenshots/home.png', size: 900, type: 'blob' }],
        });
      if (url.endsWith('/readme'))
        return Response.json({
          path: 'README.md',
          content: Buffer.from('![Home](screenshots/home.png)').toString('base64'),
        });
      return Response.json({
        private: false,
        name: 'single',
        full_name: 'test-scope-owner/single',
        html_url: 'https://github.com/test-scope-owner/single',
        default_branch: 'main',
      });
    });
    const result = await new GitHubClient().projectImages('single');
    expect(result.images[0].alt).toBe('Home');
    expect(result.images[0].src).toContain(sha);
    expect(result.sources.some((s) => s.url === result.images[0].sourceUrl)).toBe(true);
    expect(
      urls.every((url) => url.startsWith('https://api.github.com/repos/test-scope-owner/single')),
    ).toBe(true);
  });
  it('rejects API redirects to a different owner', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ private: false, name: 'single', full_name: 'other-owner/single' }),
    );
    await expect(new GitHubClient().inspect('single')).rejects.toThrow('chủ sở hữu');
  });
  it('turns API quota errors into actionable safe messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('sensitive upstream error body', { status: 403 }),
    );
    await expect(new GitHubClient().profile()).rejects.toThrow('giới hạn');
  });
  it('respects cancellation before cached/network work', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.spyOn(globalThis, 'fetch');
    await expect(new GitHubClient(controller.signal).profile()).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reads only bounded Markdown README content for the overview, without following embedded URLs', async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith('/readme'))
        return Response.json({
          type: 'file',
          path: 'README.md',
          size: 5000,
          encoding: 'base64',
          html_url: 'https://github.com/test-scope-owner/single/blob/main/README.md',
          content: Buffer.from(
            'React dashboard\n![remote](https://evil.example/collect)\n```js\nignore this code\n```\n' +
              'x'.repeat(3000),
          ).toString('base64'),
        });
      return Response.json({
        private: false,
        fork: false,
        name: 'single',
        full_name: 'test-scope-owner/single',
      });
    });
    const result = await new GitHubClient().overviewReadme('single', 1200);
    expect(result.status).toBe('read');
    expect(result.text?.length).toBeLessThanOrEqual(1200);
    expect(result.text).not.toMatch(/evil.example|ignore this code/);
    expect(result.truncated).toBe(true);
    expect(urls).toEqual([
      'https://api.github.com/repos/test-scope-owner/single',
      'https://api.github.com/repos/test-scope-owner/single/readme',
    ]);
    await expect(new GitHubClient().overviewReadme('outside')).rejects.toThrow('phạm vi');
    expect(urls).toHaveLength(2);
  });
  it('handles missing READMEs and refuses a private repo before reading content', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) =>
        String(input).endsWith('/readme')
          ? new Response('', { status: 404 })
          : Response.json({ private: false, name: 'single', full_name: 'test-scope-owner/single' }),
      );
    expect(await new GitHubClient().overviewReadme('single')).toMatchObject({
      status: 'missing',
      text: null,
    });
    fetcher.mockClear();
    fetcher.mockResolvedValue(Response.json({ private: true }));
    await expect(new GitHubClient().overviewReadme('single')).rejects.toThrow('công khai');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reuses validated inventory metadata and includes technology lines beyond a long README introduction', async () => {
    vi.stubEnv('REPO_URL', 'https://github.com/overview-cache-owner');
    vi.stubEnv('GITHUB_CACHE_SECONDS', '300');
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/repos?'))
        return Response.json([
          {
            private: false,
            fork: false,
            name: 'dashboard',
            full_name: 'overview-cache-owner/dashboard',
          },
        ]);
      if (url.endsWith('/readme'))
        return Response.json({
          type: 'file',
          path: 'README.md',
          size: 5000,
          encoding: 'base64',
          content: Buffer.from(
            'Warehouse project.\n' +
              'An introduction. '.repeat(200) +
              '\nFrontend: React and TypeScript',
          ).toString('base64'),
        });
      throw new Error('Unexpected metadata or code fetch');
    });
    const github = new GitHubClient();
    await github.repositories();
    const readme = await github.overviewReadme('dashboard', 500);
    expect(readme.text).toContain('Warehouse project.');
    expect(readme.text).toContain('Frontend: React and TypeScript');
    expect(readme.text!.length).toBeLessThanOrEqual(500);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('filters public activity by configured owner, actor, repository and public visibility; omits raw payload', async () => {
    const event = {
      type: 'PushEvent',
      public: true,
      actor: { login: 'test-scope-owner' },
      repo: { name: 'test-scope-owner/single' },
      created_at: '2026-10-01T12:00:00Z',
      payload: { secrets: 'must not reach the model', url: 'https://evil.example' },
    };
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json([
          event,
          { ...event, public: false },
          { ...event, actor: { login: 'other-user' } },
          { ...event, repo: { name: 'other-owner/single' } },
          { ...event, repo: { name: 'test-scope-owner/outside' } },
        ]),
      );
    const result = await new GitHubClient().recentActivity([
      {
        name: 'single',
        url: 'https://github.com/test-scope-owner/single',
        fork: false,
        description: null,
        language: null,
        stars: 0,
        updated: '',
        branch: 'main',
      },
    ]);
    expect(result.events).toEqual([
      {
        type: 'PushEvent',
        repository: 'single',
        fork: false,
        date: event.created_at,
        url: 'https://github.com/test-scope-owner/single',
      },
    ]);
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/test-scope-owner/single/events?per_page=30',
    );
    expect(JSON.stringify(result)).not.toMatch(/must not reach|evil.example/);
  });
});
