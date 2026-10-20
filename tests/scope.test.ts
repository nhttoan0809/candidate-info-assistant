import { describe, expect, it } from 'vitest';
import { assertRepo, assertSafePath, parseScope } from '../src/lib/scope';
describe('GitHub scope boundary', () => {
  it('accepts an account or exact repository', () => {
    expect(parseScope('https://github.com/example')).toEqual({ owner: 'example', repo: undefined });
    expect(parseScope('https://github.com/example/project.git/')).toEqual({
      owner: 'example',
      repo: 'project',
    });
  });
  it.each([
    'https://github.com.evil.test/example',
    'http://github.com/example',
    'https://x@github.com/example',
    'https://github.com/example/repo/tree/main',
    'https://github.com/example?tab=repositories',
    'https://github.com/',
  ])('rejects malformed scope %s', (url) => {
    expect(() => parseScope(url)).toThrow();
  });
  it('prevents a model from escaping a single-repo scope', () => {
    expect(() => assertRepo({ owner: 'example', repo: 'one' }, 'two')).toThrow();
    expect(() => assertRepo({ owner: 'example' }, '../other')).toThrow();
    expect(() => assertRepo({ owner: 'example', repo: 'one' }, 'ONE')).not.toThrow();
  });
  it.each([
    '../.env',
    '.env.local',
    'app/.env.production',
    '/etc/passwd',
    'src/%2e%2e/file',
    'id_rsa.key',
    'private.pem',
    'a\\b',
    '.git/config',
    'secrets.json',
    'resume.pdf',
  ])('blocks unsafe file %s', (path) => expect(() => assertSafePath(path)).toThrow());
  it('allows source and Markdown documents', () => {
    for (const p of ['src/app/page.tsx', 'README.md', 'docs/cv.md', 'package.json'])
      expect(() => assertSafePath(p)).not.toThrow();
  });
});
