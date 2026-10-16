/**
 * The development `<link>` in index.html.
 *
 * Two invariants that, if broken, fail nowhere else:
 *
 *  1. The URL has to be **absolute**. That is the only thing keeping it out of
 *     the bundle: Vite resolves a node_modules path and it ends up inside
 *     dist/main.css (measured: 1,278,396 B instead of 65).
 *  2. The version has to stay aligned with the installed package. That is the
 *     price of writing it by hand, and what this test pays.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');

const indexHtml = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/** Active `<link>`s only: the ones inside a comment do not count. */
function activeLinks(html: string): string[] {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .match(/<link\b[^>]*>/g) ?? [];
}

const dynamicLink = activeLinks(indexHtml)
  .find((link) => link.includes('ui-react') && link.includes('dynamic-ui'));

function installedVersion(): string {
  const pkg = path.join(ROOT, 'node_modules/@dynamic-framework/ui-react/package.json');
  return JSON.parse(readFileSync(pkg, 'utf8')).version as string;
}

describe("Dynamic's <link> in index.html", () => {
  it('exists and is active', () => {
    expect(dynamicLink, "index.html is missing the <link> to Dynamic's CSS").toBeDefined();
  });

  it('uses an absolute URL, so it stays out of the bundle', () => {
    const href = /href="([^"]+)"/.exec(dynamicLink ?? '')?.[1];

    expect(href, 'the <link> has no href').toBeDefined();
    expect(
      /^https:\/\//.test(href ?? ''),
      'href must be an absolute https:// URL — Vite resolves a local path and it '
      + `ends up inside dist/main.css. Found: ${href}`,
    ).toBe(true);
  });

  it('points at the same @dynamic-framework/ui-react version that is installed', () => {
    const linkedVersion = /\/assets\/([^/]+)\/ui-react\//.exec(dynamicLink ?? '')?.[1];
    const installed = installedVersion();

    expect(
      linkedVersion,
      "could not read the version from the href; did the CDN's URL format change?",
    ).toBeDefined();
    expect(
      linkedVersion,
      `index.html links Dynamic ${linkedVersion} but ${installed} is installed. `
      + "Update index.html's <link> or the dependency.",
    ).toBe(installed);
  });
});

describe("the framework's CSS is not imported from the code", () => {
  it('main.tsx imports the widget styles only', () => {
    const mainTsx = readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');

    // The easiest regression to commit: putting the import back "because it
    // looked wrong in dev". Nothing else catches it — the site loads Dynamic's
    // CSS for the whole page, so a widget that bundles its own copy still
    // renders fine locally while shipping 1.2 MB and a duplicate :root.
    expect(mainTsx).not.toContain('dynamic-ui.css');
  });
});
