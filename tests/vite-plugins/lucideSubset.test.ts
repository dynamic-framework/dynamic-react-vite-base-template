import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import lucideSubset, {
  buildIconFileMap,
  listSourceFiles,
  loadCoreIcons,
  resolveLucidePaths,
  resolveUiReactDir,
  scanSource,
} from '../../.vite/plugins/lucideSubset';

const ROOT = path.resolve(__dirname, '../..');

/** Contexto minimo para invocar los hooks del plugin fuera de Rollup. */
function makeContext() {
  const warnings: string[] = [];
  const errors: string[] = [];
  const emitted: Array<{ fileName: string; source: string }> = [];
  return {
    warnings,
    errors,
    emitted,
    ctx: {
      warn: (message: string) => { warnings.push(String(message)); },
      error: (message: string) => {
        errors.push(String(message));
        throw new Error(String(message));
      },
      emitFile: (file: { fileName: string; source: string }) => { emitted.push(file); },
    },
  };
}

type AnyHook = (...args: unknown[]) => unknown;
const hook = (plugin: unknown, name: string) => (plugin as Record<string, AnyHook>)[name];

describe('scanSource — catastro de literales', () => {
  it('recolecta literales de atributos JSX', () => {
    const code = `
      export default function C() {
        return <DButton icon="Book" iconStart="Search" />;
      }
    `;
    const { literals } = scanSource(code, 'C.tsx');
    expect(literals.has('Book')).toBe(true);
    expect(literals.has('Search')).toBe(true);
  });

  it('recolecta literales fuera de posicion de atributo: el caso MyLink', () => {
    // MyLink recibe el nombre por prop (`icon={icon}`), asi que el literal vive
    // en el sitio de llamada. Un recolector que solo mirara atributos de
    // componentes D* perderia estos tres nombres.
    const myLink = `
      type Props = { icon: string };
      export default function MyLink({ icon }: Props) {
        return <DIcon icon={icon} />;
      }
    `;
    const myComponent = `
      export default function MyComponent() {
        return (
          <>
            <MyLink icon="Book" title="Learn" />
            <MyLink icon="Brush" title="Themes" />
            <MyLink icon="Layout" title="Components" />
          </>
        );
      }
    `;
    const wrapper = scanSource(myLink, 'MyLink.tsx');
    const caller = scanSource(myComponent, 'MyComponent.tsx');

    // El envoltorio no aporta nombres, pero si un sitio dinamico.
    expect([...wrapper.literals].filter((l) => l === 'Book')).toHaveLength(0);
    expect(wrapper.dynamicSites).toHaveLength(1);
    expect(wrapper.dynamicSites[0].prop).toBe('icon');

    // Los nombres reales salen del sitio de llamada.
    expect(caller.literals.has('Book')).toBe(true);
    expect(caller.literals.has('Brush')).toBe(true);
    expect(caller.literals.has('Layout')).toBe(true);
    expect(caller.dynamicSites).toHaveLength(0);
  });

  it('recolecta literales en arrays, mapas de constantes y defaults de prop', () => {
    const code = `
      const ICONS = { success: 'CheckCircle', error: 'XCircle' };
      const LIST = ['Clock', 'Car'];
      export function E({ icon = 'FileText' }: { icon?: string }) {
        return <DIcon icon={icon} />;
      }
    `;
    const { literals } = scanSource(code, 'E.tsx');
    for (const name of ['CheckCircle', 'XCircle', 'Clock', 'Car', 'FileText']) {
      expect(literals.has(name)).toBe(true);
    }
  });

  it('no marca como dinamico un icon={\'literal\'} entre llaves', () => {
    const { literals, dynamicSites } = scanSource(
      '<DIcon icon={\'Book\'} />;',
      'F.tsx',
    );
    expect(literals.has('Book')).toBe(true);
    expect(dynamicSites).toHaveLength(0);
  });

  it('anota iconStart e iconEnd no literales', () => {
    const code = '<DInput iconStart={a} iconEnd={b} icon="Plus" />;';
    const { dynamicSites } = scanSource(code, 'G.tsx');
    expect(dynamicSites.map((s) => s.prop).sort()).toEqual(['iconEnd', 'iconStart']);
  });

  it('recorre src/ del template y encuentra los nombres del widget de referencia', () => {
    const files = listSourceFiles(path.join(ROOT, 'src'));
    expect(files.length).toBeGreaterThan(0);
    const literals = new Set<string>();
    for (const file of files) {
      for (const literal of scanSource(fs.readFileSync(file, 'utf8'), file).literals) {
        literals.add(literal);
      }
    }
    for (const name of ['Book', 'Brush', 'Layout', 'Plus']) {
      expect(literals.has(name)).toBe(true);
    }
  });
});

describe('buildIconFileMap — mapeo nombre -> archivo', () => {
  const { indexFile } = resolveLucidePaths(ROOT, resolveUiReactDir(ROOT));
  const map = buildIconFileMap(fs.readFileSync(indexFile, 'utf8'), indexFile);

  it('mapea Share2 a share-2.js y no a share2.js', () => {
    // El limite letra->digito es donde falla una transformacion
    // PascalCase -> kebab: por eso el mapa se deriva del indice.
    expect(map.get('Share2')).toBe('./icons/share-2.js');
  });

  it('mapea los alias deprecados del nucleo a su archivo canonico', () => {
    expect(map.get('AlertCircle')).toBe('./icons/circle-alert.js');
    expect(map.get('AlertTriangle')).toBe('./icons/triangle-alert.js');
    expect(map.get('CheckCircle')).toBe('./icons/circle-check-big.js');
    expect(map.get('MoreVertical')).toBe('./icons/ellipsis-vertical.js');
  });

  it('CheckCircle y CircleCheckBig comparten archivo', () => {
    expect(map.get('CheckCircle')).toBe(map.get('CircleCheckBig'));
  });

  it('no expone el namespace "icons" del indice', () => {
    // `export { index as icons }` no tiene moduleSpecifier: debe quedar fuera,
    // porque reintroducirlo devolveria el catalogo completo al bundle.
    expect(map.has('icons')).toBe(false);
  });

  it('ignora nombres que no existen', () => {
    expect(map.has('check')).toBe(false);
    expect(map.has('arrow-left')).toBe(false);
    expect(map.has('NoExisteEsteIcono')).toBe(false);
  });

  it('parsea solo reexports de default', () => {
    const fake = [
      "import * as index from './icons/index.js';",
      'export { index as icons };',
      "export { default as Foo, default as FooIcon } from './icons/foo.js';",
      "export { notDefault as Bar } from './icons/bar.js';",
    ].join('\n');
    const m = buildIconFileMap(fake);
    expect(m.get('Foo')).toBe('./icons/foo.js');
    expect(m.get('FooIcon')).toBe('./icons/foo.js');
    expect(m.has('Bar')).toBe(false);
    expect(m.has('icons')).toBe(false);
  });
});

describe('loadCoreIcons — nucleo y respaldo', () => {
  it('usa el respaldo embebido de 27 nombres cuando el paquete no publica icons-core.json', () => {
    // Directorio sintetico sin dist/icons-core.json, en vez del ui-react
    // instalado: el camino del respaldo se cubre igual cuando Dynamic 2.10
    // empiece a publicar el archivo.
    const dir = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.tmp-core-'));
    try {
      const core = loadCoreIcons(dir);
      expect(core.source).toBe('fallback');
      expect(core.names).toHaveLength(27);
      expect(new Set(core.names).size).toBe(27);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('los 27 nombres del respaldo existen en el lucide-react instalado', () => {
    const { indexFile } = resolveLucidePaths(ROOT, resolveUiReactDir(ROOT));
    const map = buildIconFileMap(fs.readFileSync(indexFile, 'utf8'), indexFile);
    const dir = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.tmp-core-'));
    try {
      const core = loadCoreIcons(dir);
      const missing = core.names.filter((name) => !map.has(name));
      expect(missing).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lee un icons-core.json en forma de array', () => {
    const dir = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.tmp-core-'));
    try {
      fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'dist', 'icons-core.json'), JSON.stringify(['X', 'Plus']));
      const core = loadCoreIcons(dir);
      expect(core.source).toBe('package');
      expect(core.names).toEqual(['X', 'Plus']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lee un icons-core.json en forma de objeto con clave icons', () => {
    const dir = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.tmp-core-'));
    try {
      fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'dist', 'icons-core.json'),
        JSON.stringify({ icons: ['Eye', 'EyeOff'] }),
      );
      const core = loadCoreIcons(dir);
      expect(core.source).toBe('package');
      expect(core.names).toEqual(['Eye', 'EyeOff']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('cae al respaldo si el JSON esta corrupto o vacio', () => {
    const dir = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.tmp-core-'));
    try {
      fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'dist', 'icons-core.json'), '{ no es json');
      expect(loadCoreIcons(dir).source).toBe('fallback');
      fs.writeFileSync(path.join(dir, 'dist', 'icons-core.json'), '[]');
      expect(loadCoreIcons(dir).source).toBe('fallback');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('avisa en el build si y solo si el nucleo viene del respaldo', async () => {
    const plugin = lucideSubset();
    const { ctx, warnings, emitted } = makeContext();
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    await hook(plugin, 'buildStart').call(ctx);
    hook(plugin, 'generateBundle').call(ctx);

    // Con 2.8.0/2.9.0 el nucleo sale del respaldo y hay aviso; a partir de
    // 2.10 sale del paquete y no debe haberlo. El test se ata a coreSource,
    // no a la version instalada.
    const { coreSource } = JSON.parse(emitted[0].source);
    const aviso = warnings.some((w) => w.includes('lista de respaldo del nucleo'));
    expect(aviso).toBe(coreSource === 'fallback');
  });
});

describe('resolveId — guarda por importador', () => {
  const uiReactDir = resolveUiReactDir(ROOT);

  function ready() {
    const plugin = lucideSubset();
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    return plugin;
  }

  it('sustituye Lucide cuando el importador esta dentro de ui-react', async () => {
    const plugin = ready();
    const importer = path.join(uiReactDir, 'dist', 'index.esm.js');
    const resolved = await hook(plugin, 'resolveId').call(makeContext().ctx, 'lucide-react', importer);
    expect(resolved).toBe('\0virtual:lucide-subset');
  });

  it('NO sustituye Lucide cuando el importador es codigo del widget', async () => {
    const plugin = ready();
    const importer = path.join(ROOT, 'src', 'components', 'MyComponent.tsx');
    const resolved = await hook(plugin, 'resolveId').call(makeContext().ctx, 'lucide-react', importer);
    expect(resolved).toBeFalsy();
  });

  it('NO sustituye Lucide cuando el importador es otra dependencia', async () => {
    const plugin = ready();
    const importer = path.join(ROOT, 'node_modules', 'otra-lib', 'dist', 'index.js');
    const resolved = await hook(plugin, 'resolveId').call(makeContext().ctx, 'lucide-react', importer);
    expect(resolved).toBeFalsy();
  });

  it('no toca otros especificadores ni las importaciones sin importador', async () => {
    const plugin = ready();
    const importer = path.join(uiReactDir, 'dist', 'index.esm.js');
    const ctx = makeContext().ctx;
    expect(await hook(plugin, 'resolveId').call(ctx, 'react', importer)).toBeFalsy();
    expect(await hook(plugin, 'resolveId').call(ctx, 'lucide-react/dynamic', importer)).toBeFalsy();
    expect(await hook(plugin, 'resolveId').call(ctx, 'lucide-react', undefined)).toBeFalsy();
  });

  it('no hace nada cuando disabled es true', async () => {
    const plugin = lucideSubset({ disabled: true });
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    const ctx = makeContext().ctx;
    await hook(plugin, 'buildStart').call(ctx);
    const importer = path.join(uiReactDir, 'dist', 'index.esm.js');
    expect(await hook(plugin, 'resolveId').call(ctx, 'lucide-react', importer)).toBeFalsy();
  });
});

describe('load — modulo virtual', () => {
  it('reexporta por ruta absoluta al archivo ESM de cada icono', async () => {
    const plugin = lucideSubset();
    const { ctx } = makeContext();
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    await hook(plugin, 'buildStart').call(ctx);
    const code = await hook(plugin, 'load').call(ctx, '\0virtual:lucide-subset') as string;

    // Rutas absolutas al ESM, no al especificador desnudo (que da CJS).
    expect(code).toContain('/lucide-react/dist/esm/icons/');
    expect(code).not.toMatch(/from ["']lucide-react["']/);
    // Share2 sale del archivo correcto.
    expect(code).toMatch(/export \{ default as Share2 \} from "[^"]*\/icons\/share-2\.js"/);
    // El namespace completo no vuelve a entrar.
    expect(code).not.toContain('icons/index.js');
    // Exports del indice que no son iconos.
    expect(code).toContain('as createLucideIcon');
  });

  it('devuelve null para cualquier otro id', async () => {
    const plugin = lucideSubset();
    const { ctx } = makeContext();
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    await hook(plugin, 'buildStart').call(ctx);
    expect(await hook(plugin, 'load').call(ctx, '\0otro-modulo')).toBeFalsy();
  });
});

describe('strict — props de icono no literales', () => {
  it('falla el build cuando hay icon={expresion} e include esta vacio', () => {
    // src/components/MyLink.tsx y src/components/EmptyState.tsx tienen
    // `icon={icon}`: son los dos sitios dinamicos reales del template.
    const plugin = lucideSubset({ strict: true, include: [] });
    const { ctx, errors } = makeContext();
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    expect(() => hook(plugin, 'buildStart').call(ctx)).toThrow(/strict/);
    expect(errors[0]).toContain('MyLink.tsx');
    expect(errors[0]).toContain('EmptyState.tsx');
  });

  it('no falla cuando include declara nombres', () => {
    const plugin = lucideSubset({ strict: true, include: ['Rocket'] });
    const { ctx } = makeContext();
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    expect(() => hook(plugin, 'buildStart').call(ctx)).not.toThrow();
  });

  it('no falla con strict desactivado', () => {
    const plugin = lucideSubset({ strict: false });
    const { ctx } = makeContext();
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    expect(() => hook(plugin, 'buildStart').call(ctx)).not.toThrow();
  });
});

describe('manifest', () => {
  it('emite icons-manifest.json con la procedencia de cada nombre', async () => {
    const plugin = lucideSubset({ include: ['Rocket'] });
    const { ctx, emitted } = makeContext();
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    await hook(plugin, 'buildStart').call(ctx);
    hook(plugin, 'generateBundle').call(ctx);

    expect(emitted).toHaveLength(1);
    expect(emitted[0].fileName).toBe('icons-manifest.json');
    const manifest = JSON.parse(emitted[0].source);
    // Sin fijar version ni fuente del nucleo: ambas dependen de las
    // dependencias instaladas y no de la correccion del plugin.
    expect(['package', 'fallback']).toContain(manifest.coreSource);
    expect(manifest.lucideReact)
      .toBe(resolveLucidePaths(ROOT, resolveUiReactDir(ROOT)).version);
    expect(manifest.fromInclude).toEqual(['Rocket']);
    expect(manifest.fromSource).toContain('Book');
    expect(manifest.fromCore.length).toBeGreaterThan(0);
    // included es la union sin duplicados y ordenada.
    const union = new Set([
      ...manifest.fromSource, ...manifest.fromCore, ...manifest.fromInclude,
    ]);
    expect(manifest.included).toEqual([...union].sort());
  });

  it('avisa y omite nombres de include que no existen en Lucide', async () => {
    const plugin = lucideSubset({ include: ['NoExisteEsteIcono', 'Rocket'] });
    const { ctx, warnings, emitted } = makeContext();
    hook(plugin, 'configResolved').call(null, { root: ROOT });
    await hook(plugin, 'buildStart').call(ctx);
    hook(plugin, 'generateBundle').call(ctx);
    expect(warnings.some((w) => w.includes('NoExisteEsteIcono'))).toBe(true);
    expect(JSON.parse(emitted[0].source).fromInclude).toEqual(['Rocket']);
  });
});

describe('metadatos del plugin', () => {
  it('solo actua en build y antes de vite:resolve', () => {
    const plugin = lucideSubset() as unknown as Record<string, unknown>;
    expect(plugin.name).toBe('lucide-subset');
    // apply: 'build' es lo que lo desactiva en vite dev y en el preview del CLI.
    expect(plugin.apply).toBe('build');
    // enforce: 'pre' es necesario porque vite:resolve tambien responde a
    // 'lucide-react' y en resolveId gana el primero que contesta.
    expect(plugin.enforce).toBe('pre');
  });
});
