import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * `next/font/google` downloads font files from fonts.googleapis.com during
 * `next build`. When that request fails the whole build fails with
 * "An error occurred in `next/font`" — it broke CI and the rs-dev image build
 * twice on 2026-10-02, and a production image build takes ~75 minutes to redo.
 *
 * Fonts are committed under `src/app/fonts/` and loaded with `next/font/local`
 * so the build never touches the network for them.
 */
const SRC = path.join(process.cwd(), 'src');
const LAYOUT = readFileSync(path.join(SRC, 'app/layout.tsx'), 'utf8');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('self-hosted fonts', () => {
  it('no source file imports next/font/google', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes('next/font/google'))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('no stylesheet pulls fonts from fonts.googleapis.com', () => {
    const css = readFileSync(path.join(SRC, 'styles/index.css'), 'utf8');

    expect(css).not.toContain('fonts.googleapis.com');
  });

  it('the root layout loads Montserrat with next/font/local', () => {
    expect(LAYOUT).toMatch(/from ["']next\/font\/local["']/);
    expect(LAYOUT).toContain('--font-montserrat');
  });

  it('every font file the layout references is committed', () => {
    const srcs = [...LAYOUT.matchAll(/src:\s*["'](\.\/fonts\/[^"']+)["']/g)].map((m) => m[1]!);

    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) {
      expect(existsSync(path.join(SRC, 'app', src))).toBe(true);
    }
  });
});
