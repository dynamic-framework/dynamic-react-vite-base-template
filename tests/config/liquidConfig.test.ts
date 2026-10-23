import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `liquidConfig` initializes `liquidParser` with `liquid.json` in development
 * only. Outside it, it must leave the parser alone: that is what lets the build
 * fold the block away so neither the JSON nor liquidjs reach dist/main.js.
 *
 * This covers the branching logic, not the bundling. Under vitest
 * `import.meta.env.DEV` is read at runtime, so the `if` really branches here;
 * the build-time elimination it enables is what keeps the values out of the
 * artifact.
 */
async function loadParser() {
  vi.resetModules();
  await import('../../src/config/liquidConfig');
  const { default: liquidParser } = await import('../../src/utils/liquidParser');
  return liquidParser;
}

describe('liquidConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('en desarrollo resuelve las variables desde liquid.json', async () => {
    vi.stubEnv('DEV', true);
    const liquidParser = await loadParser();

    expect(liquidParser.engine).toBeDefined();
    expect(liquidParser.parse('{{vars.use-mocks}}')).toBe('true');
  });

  it('fuera de desarrollo no carga liquid.json ni el motor', async () => {
    vi.stubEnv('DEV', false);
    const liquidParser = await loadParser();

    expect(liquidParser.engine).toBeUndefined();
    expect(liquidParser.library).toEqual({});
    expect(liquidParser.parse('{{site.language}}')).toBe('{{site.language}}');
  });
});