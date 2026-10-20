import { expect, it, vi } from 'vitest';
import { createTools } from '../src/lib/agent/tools';
import { z } from 'zod';
import type { GitHubClient } from '../src/lib/github';
it('attaches real discovered images both for explicit image tools and normal project inspection', async () => {
  const picture = {
    id: 'img',
    repository: 'app',
    path: 'screenshots/home.png',
    alt: 'Home',
    origin: 'readme' as const,
    src:
      'https://raw.githubusercontent.com/example/app/' + 'a'.repeat(40) + '/screenshots/home.png',
    sourceUrl: 'https://github.com/example/app/blob/' + 'a'.repeat(40) + '/screenshots/home.png',
  };
  const evidence = {
    id: 'source',
    title: 'Image source',
    url: picture.sourceUrl,
    kind: 'file' as const,
  };
  const github = {
    inspect: vi.fn().mockResolvedValue({ sources: [], repository: {} }),
    projectImages: vi
      .fn()
      .mockResolvedValue({ images: [picture], sources: [evidence], note: 'Found' }),
  } as unknown as GitHubClient;
  const addImages = vi.fn();
  const addSources = vi.fn();
  const report = vi.fn();
  const tools = createTools(github, report, addSources, addImages);
  const options = { toolCallId: 'test', messages: [], context: {} };
  await tools.find_project_images.execute!({ repository: 'app' }, options);
  expect(addImages).toHaveBeenCalledWith([picture]);
  expect(addSources).toHaveBeenCalledWith([evidence]);
  addImages.mockClear();
  await tools.inspect_repository.execute!({ repository: 'app' }, options);
  expect(addImages).toHaveBeenCalledWith([picture]);
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ label: 'Tìm hình ảnh dự án', status: 'done' }),
  );
});

it('constrains quick repository inspection to the selected repo', () => {
  const tools = createTools({} as GitHubClient, vi.fn(), vi.fn(), vi.fn(), 'selected-app');
  const schema = tools.inspect_repository.inputSchema as z.ZodType;
  expect(schema.safeParse({ repository: 'selected-app' }).success).toBe(true);
  expect(schema.safeParse({ repository: 'another-app' }).success).toBe(false);
});
