import { beforeEach, expect, it, vi } from 'vitest';
import { createTools } from '../src/lib/agent/tools';
import type { GitHubClient } from '../src/lib/github';
import type { Repository } from '../src/lib/types';

beforeEach(() => {
  vi.stubEnv('MODEL_URL', 'http://localhost:11434/v1');
  vi.stubEnv('MODEL_NAME', 'test');
  vi.stubEnv('REPO_URL', 'https://github.com/example');
  vi.stubEnv('MAX_OVERVIEW_READMES', '5');
});
const repositories = Array.from(
  { length: 8 },
  (_, index) =>
    ({
      name: `repo-${index}`,
      url: `https://github.com/example/repo-${index}`,
      fork: index === 1,
      updated: '2026-10-01',
    }) as Repository,
);
const options = { toolCallId: 'overview', messages: [], context: {} };

it('bounds README concurrency and coverage, excludes forks, and preserves partial evidence when GitHub fails', async () => {
  let active = 0;
  let peak = 0;
  const github = {
    profile: vi.fn().mockResolvedValue({ login: 'example', url: 'https://github.com/example' }),
    repositories: vi.fn().mockResolvedValue(repositories),
    recentActivity: vi.fn().mockRejectedValue(new Error('upstream unavailable')),
    overviewReadme: vi.fn().mockImplementation(async (name: string) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      if (name === 'repo-2') throw new Error('quota exceeded');
      if (name === 'repo-3') return { repository: name, status: 'missing', text: null };
      return {
        repository: name,
        status: 'read',
        text: 'A React app',
        source: {
          id: name,
          title: name,
          url: `https://github.com/example/${name}/blob/main/README.md`,
          kind: 'file',
        },
      };
    }),
    inspect: vi.fn(),
    projectImages: vi.fn(),
    readFile: vi.fn(),
  };
  const report = vi.fn();
  const addSources = vi.fn();
  const tools = createTools(
    github as unknown as GitHubClient,
    report,
    addSources,
    undefined,
    undefined,
    true,
  );
  const request = () => tools.discover_candidate.execute!({}, options);
  const [first, repeated] = await Promise.all([request(), request()]);
  expect(first).toBe(repeated);
  expect(github.profile).toHaveBeenCalledTimes(1);
  const result = first as {
    coverage: { read: number; unavailable: string[]; skipped: string[] };
    activity: { status: string };
  };
  expect(peak).toBe(4);
  expect(github.overviewReadme.mock.calls.map((call) => call[0]).sort()).toEqual([
    'repo-0',
    'repo-2',
    'repo-3',
    'repo-4',
    'repo-5',
  ]);
  expect(result.coverage).toMatchObject({
    read: 3,
    unavailable: ['repo-2'],
    skipped: ['repo-6', 'repo-7'],
  });
  expect(result.activity.status).toBe('unavailable');
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ label: 'Đọc README', detail: 'repo-0', status: 'running' }),
  );
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ label: 'Đọc README', status: 'error' }),
  );
  expect(addSources).toHaveBeenCalledWith([
    expect.objectContaining({ url: 'https://github.com/example/repo-0/blob/main/README.md' }),
  ]);
  expect(github.inspect).not.toHaveBeenCalled();
  expect(github.projectImages).not.toHaveBeenCalled();
  expect(github.readFile).not.toHaveBeenCalled();
});

it('keeps ordinary discovery lightweight and adds README/activity work only to the server-owned overview', async () => {
  const github = {
    profile: vi.fn().mockResolvedValue({ login: 'example', url: 'https://github.com/example' }),
    repositories: vi.fn().mockResolvedValue(repositories),
    recentActivity: vi.fn(),
    overviewReadme: vi.fn(),
  };
  await createTools(github as unknown as GitHubClient, vi.fn(), vi.fn()).discover_candidate
    .execute!({}, options);
  expect(github.recentActivity).not.toHaveBeenCalled();
  expect(github.overviewReadme).not.toHaveBeenCalled();
});
