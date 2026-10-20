import type { ProjectImage } from './types';
import { assertRepo, type RepoScope } from './scope';

export interface TreeEntry {
  path: string;
  type: string;
  size?: number;
  sha?: string;
}
const raster = /\.(png|jpe?g|webp|gif|avif)$/i;
const decorative =
  /(?:^|[\/_-])(?:logo|icons?|badges?|favicon|avatar|sprite|placeholder|loading)(?:[\/_.-]|$)/i;
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

function readmePath(
  raw: string,
  owner: string,
  repo: string,
  branch: string,
  readme: string,
): string | null {
  try {
    const value = raw.replace(/^<|>$/g, '');
    if (value.startsWith('//')) return null;
    const url = new URL(value, `https://repo.invalid/${encodePath(readme)}`);
    if (url.username || url.password || url.port || url.protocol !== 'https:') return null;
    let path = decodeURIComponent(url.pathname);
    if (url.hostname === 'repo.invalid') path = path.slice(1);
    else {
      const prefix =
        url.hostname === 'raw.githubusercontent.com'
          ? `/${owner}/${repo}/${branch}/`
          : url.hostname === 'github.com'
            ? `/${owner}/${repo}/blob/${branch}/`
            : '';
      if (!prefix || !path.startsWith(prefix)) return null;
      path = path.slice(prefix.length);
    }
    return path && !path.includes('\\') && !path.includes('\u0000') ? path : null;
  } catch {
    return null;
  }
}

export function selectProjectImages(options: {
  owner: string;
  repo: string;
  branch: string;
  commit: string;
  tree: TreeEntry[];
  readme: string;
  readmePath: string;
  limit: number;
}): ProjectImage[] {
  const { owner, repo, branch, commit, tree, readme, readmePath: doc, limit } = options;
  if (!/^[a-f0-9]{40,64}$/i.test(commit)) throw new Error('Không xác minh được phiên bản ảnh.');
  const references = new Map<string, string>();
  const matches: { path: string; alt: string; position: number }[] = [];
  const add = (url: string, alt = '', position = 0) => {
    const path = readmePath(url, owner, repo, branch, doc);
    if (path)
      matches.push({
        path,
        alt: alt
          .replace(/<[^>]*>/g, '')
          .trim()
          .slice(0, 160),
        position,
      });
  };
  for (const m of readme.matchAll(/!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g))
    add(m[2], m[1], m.index);
  const definitions = new Map(
    [...readme.matchAll(/^\s*\[([^\]]+)\]:\s*(<[^>]+>|\S+)/gm)].map((m) => [
      m[1].toLowerCase(),
      m[2],
    ]),
  );
  for (const m of readme.matchAll(/!\[([^\]]*)\]\[([^\]]*)\]/g)) {
    const url = definitions.get((m[2] || m[1]).toLowerCase());
    if (url) add(url, m[1], m.index);
  }
  for (const m of readme.matchAll(/<img\b[^>]*>/gi)) {
    const src = m[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) add(src, m[0].match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1], m.index);
  }
  for (const match of matches.sort((a, b) => a.position - b.position))
    if (!references.has(match.path)) references.set(match.path, match.alt);
  return (
    tree
      .filter(
        (f) =>
          f.type === 'blob' &&
          raster.test(f.path) &&
          !decorative.test(f.path) &&
          f.path.length <= 300 &&
          !f.path.includes('\\') &&
          !f.path.split('/').some((p) => !p || p === '.' || p === '..' || p.startsWith('.')) &&
          typeof f.size === 'number' &&
          f.size > 0 &&
          f.size <= 5_000_000,
      )
      .map((f) => ({
        file: f,
        score: references.has(f.path)
          ? 1000 - Math.min(900, [...references.keys()].indexOf(f.path))
          : /screenshots?|screens?|previews?|demo|gallery/i.test(f.path)
            ? 50
            : 0,
      }))
      // Generic photos/textures in assets are not evidence of the application's appearance.
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path))
      .slice(0, limit)
      .map(({ file }) => ({
        id: `${repo}:${commit}:${file.path}`,
        repository: repo,
        path: file.path,
        src: `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${commit}/${encodePath(file.path)}`,
        sourceUrl: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${commit}/${encodePath(file.path)}`,
        alt: references.get(file.path) || `Ảnh trong ${repo}: ${file.path.split('/').pop()}`,
        origin: references.has(file.path) ? ('readme' as const) : ('repository' as const),
      }))
  );
}

/** Client-side defense for persisted metadata. Model Markdown never supplies the image URL. */
export function isSafeProjectImage(image: ProjectImage, scope?: RepoScope): boolean {
  try {
    if (
      !image ||
      typeof image.src !== 'string' ||
      typeof image.sourceUrl !== 'string' ||
      typeof image.path !== 'string' ||
      !raster.test(image.path)
    )
      return false;
    const src = new URL(image.src);
    const source = new URL(image.sourceUrl);
    const parts = src.pathname.split('/').slice(1);
    if (scope) {
      assertRepo(scope, image.repository);
      if (decodeURIComponent(parts[0]).toLowerCase() !== scope.owner.toLowerCase()) return false;
    }
    return (
      src.protocol === 'https:' &&
      src.hostname === 'raw.githubusercontent.com' &&
      !src.port &&
      !src.username &&
      !src.password &&
      !src.search &&
      !src.hash &&
      source.protocol === 'https:' &&
      source.hostname === 'github.com' &&
      !source.port &&
      !source.username &&
      !source.password &&
      !source.search &&
      !source.hash &&
      parts.length >= 4 &&
      /^[a-f0-9]{40,64}$/i.test(parts[2]) &&
      decodeURIComponent(parts[1]) === image.repository &&
      parts.slice(3).map(decodeURIComponent).join('/') === image.path &&
      source.pathname === `/${parts[0]}/${parts[1]}/blob/${parts.slice(2).join('/')}`
    );
  } catch {
    return false;
  }
}
