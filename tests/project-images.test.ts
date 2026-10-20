import { describe, expect, it } from 'vitest';
import { isSafeProjectImage, selectProjectImages, type TreeEntry } from '../src/lib/project-images';
const commit = 'a'.repeat(40);
const image = (path: string, size = 1000): TreeEntry => ({ path, type: 'blob', size });
const select = (readme: string, tree: TreeEntry[], limit = 4) =>
  selectProjectImages({
    owner: 'example',
    repo: 'app',
    branch: 'main',
    commit,
    readme,
    readmePath: 'README.md',
    tree,
    limit,
  });
describe('real project image discovery', () => {
  it('prefers README order, verifies existence, and pins URLs to the inspected commit', () => {
    const found = select(
      '![Warehouse](./docs/screenshots/warehouse.png)\n![Pallet](docs/screenshots/pallet.png)\n![Missing](docs/no-file.png)',
      [
        image('docs/screenshots/pallet.png'),
        image('docs/screenshots/warehouse.png'),
        image('screenshots/fallback.jpg'),
      ],
      2,
    );
    expect(found.map((i) => i.alt)).toEqual(['Warehouse', 'Pallet']);
    expect(found[0].src).toBe(
      `https://raw.githubusercontent.com/example/app/${commit}/docs/screenshots/warehouse.png`,
    );
    expect(found[0].sourceUrl).toContain(`/blob/${commit}/`);
    expect(found.every((i) => isSafeProjectImage(i, { owner: 'example', repo: 'app' }))).toBe(true);
  });
  it('handles reference Markdown, HTML, scoped GitHub URLs and encoded spaces', () => {
    const found = select(
      '![Preview][view]\n[view]: <docs/screen 1.png>\n<img src="docs/second.webp" alt="Settings">\n![Third](https://github.com/example/app/blob/main/docs/third.jpg?raw=true)',
      [image('docs/screen 1.png'), image('docs/second.webp'), image('docs/third.jpg')],
    );
    expect(found.map((i) => i.alt)).toEqual(['Preview', 'Settings', 'Third']);
    expect(found[0].src).toContain('screen%201.png');
  });
  it('does not fetch or attach arbitrary hosts, other repos, badges, SVGs, missing files or generic textures', () => {
    const found = select(
      '![External](https://evil.test/track.png)\n![Other repo](https://raw.githubusercontent.com/elsewhere/other/main/test.png)\n![SVG](docs/view.svg)\n![Logo](logo.png)',
      [
        image('logo.png'),
        image('docs/view.svg'),
        image('assets/texture.png'),
        image('test.png'),
        image('screenshots/huge.png', 6_000_000),
      ],
    );
    expect(found).toEqual([]);
  });
  it('finds screenshot folders without README, labels them as files rather than inferred UI descriptions', () => {
    const found = select('', [image('public/demo/home.avif'), image('src/images/background.png')]);
    expect(found).toHaveLength(1);
    expect(found[0].origin).toBe('repository');
    expect(found[0].alt).toContain('home.avif');
  });
  it('handles docs-relative paths and rejects unsafe persisted gallery URLs', () => {
    const [found] = selectProjectImages({
      owner: 'example',
      repo: 'app',
      branch: 'main',
      commit,
      readme: '![Screen](../screenshots/home.png)',
      readmePath: 'docs/README.md',
      tree: [image('screenshots/home.png')],
      limit: 4,
    });
    expect(isSafeProjectImage(found)).toBe(true);
    expect(isSafeProjectImage({ ...found, src: 'https://evil.test/x.png' })).toBe(false);
    expect(isSafeProjectImage({ ...found, src: found.src + '?tracking=1' })).toBe(false);
    expect(isSafeProjectImage(found, { owner: 'other' })).toBe(false);
    expect(isSafeProjectImage(found, { owner: 'example', repo: 'different' })).toBe(false);
    expect(
      isSafeProjectImage({
        ...found,
        sourceUrl: 'https://github.com/other/app/blob/main/screenshots/home.png',
      }),
    ).toBe(false);
  });
});
