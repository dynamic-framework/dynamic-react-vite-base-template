import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `widget.manifest.json` describe el widget fuera del código: nombre, versión,
 * versión de Dynamic UI, template de origen, theme y referencias de diseño.
 * Estos tests lo mantienen coherente con `package.json`.
 */

type DesignReference = { name: string; url: string };

type WidgetManifest = {
  name: string;
  version: string;
  dynamicUi: string;
  template: string;
  theme: string | null;
  design?: DesignReference[];
};

type PackageJson = {
  name: string;
  version: string;
  dependencies: Record<string, string>;
};

const ROOT = path.resolve(__dirname, '../..');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(ROOT, file), 'utf8')) as T;
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const PACKAGE_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

/** Separa `paquete@versión` en el último `@`, lo que admite paquetes con scope. */
function splitPackageRef(ref: string): { name: string; version: string } {
  const at = ref.lastIndexOf('@');
  return at > 0
    ? { name: ref.slice(0, at), version: ref.slice(at + 1) }
    : { name: '', version: '' };
}

function expectPackageRef(ref: string) {
  const { name, version } = splitPackageRef(ref);
  expect(name, `"${ref}" debe tener la forma paquete@versión`).toMatch(PACKAGE_NAME);
  expect(version, `"${ref}" debe terminar en una versión semver`).toMatch(SEMVER);
}

const manifest = readJson<WidgetManifest>('widget.manifest.json');
const pkg = readJson<PackageJson>('package.json');

describe('widget.manifest.json', () => {
  it('name coincide con package.json', () => {
    expect(manifest.name).toBe(pkg.name);
  });

  it('version coincide con package.json', () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it('dynamicUi coincide con el pin exacto de @dynamic-framework/ui-react', () => {
    const pinned = pkg.dependencies['@dynamic-framework/ui-react'];
    expect(pinned, '@dynamic-framework/ui-react debe fijarse a una versión exacta').toMatch(SEMVER);
    expect(manifest.dynamicUi).toBe(pinned);
  });

  it('template tiene la forma paquete@versión', () => {
    expectPackageRef(manifest.template);
  });

  it('en el propio template, template apunta a la versión actual', () => {
    const { name, version } = splitPackageRef(manifest.template);
    if (name !== pkg.name) return;
    expect(version).toBe(pkg.version);
  });

  it('theme es null o tiene la forma paquete@versión', () => {
    if (manifest.theme === null) return;
    expect(typeof manifest.theme).toBe('string');
    expectPackageRef(manifest.theme);
  });

  it('design, si existe, es una lista de { name, url } con url https', () => {
    if (manifest.design === undefined) return;
    expect(Array.isArray(manifest.design)).toBe(true);
    for (const ref of manifest.design) {
      expect(typeof ref.name).toBe('string');
      expect(ref.name.trim()).not.toBe('');
      expect(ref.url).toMatch(/^https:\/\/\S+$/);
    }
  });
});
