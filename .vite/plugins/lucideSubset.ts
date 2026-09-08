import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import type { Plugin } from 'vite';

/**
 * Replaces the `lucide-react` module imported by @dynamic-framework/ui-react
 * with a virtual module that only reexports the icons this widget needs.
 *
 * The problem: `ui-react` resolves icons with `import * as LucideIcons from
 * 'lucide-react'` and then, inside `DIconBase`, `const icons = LucideIcons`
 * followed by `icons[name]`. That dynamic access defeats tree-shaking, so the
 * bundle pulls in the whole Lucide catalog (over 1.6k icon modules) to paint a
 * handful.
 *
 * Mind the name: that `icons` is the module namespace object, not the `icons`
 * export of Lucide's index, which is a different thing (see NON_ICON_EXPORTS).
 *
 * The solution: intercept the `lucide-react` specifier ONLY when the importer
 * lives inside `@dynamic-framework/ui-react`, and serve it a module with the N
 * icons that are actually needed. `ui-react` then gets a namespace object with
 * N entries instead of thousands, and that `icons[name]` keeps working: the
 * library needs no changes.
 *
 * N is the union of three sets:
 *  1. Source scan: every string literal in `src/**` that matches a real Lucide
 *     export.
 *  2. Core: the names Dynamic's own components resolve internally (`DAlert`,
 *     `DCollapse`, `DInputPassword`, ...).
 *  3. `include`: names the widget computes at runtime, which therefore never
 *     appear as a literal anywhere.
 *
 * Build-only (`apply: 'build'`), like escapeLiquidInStrings. Under `vite dev`
 * and the Modyo CLI preview the widget sees the full Lucide, which is what you
 * want while iterating: any name works.
 */

const VIRTUAL_ID = 'virtual:lucide-subset';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;
const LUCIDE_SPECIFIER = 'lucide-react';

/**
 * Exports of Lucide's index that are not icons. They are always included in the
 * virtual module so that the namespace handed to `ui-react` keeps everything
 * that is not an icon. They weigh a few bytes.
 *
 * The index's `icons` export is left out on purpose, and must not be confused
 * with the `const icons = LucideIcons` in `DIconBase`: the latter is the module
 * namespace object, the former is a map holding the entire catalog
 * (`export { index as icons }` in the ESM index), and reintroducing it would
 * defeat the whole point of the plugin.
 */
const NON_ICON_EXPORTS = ['createLucideIcon', 'Icon'];

/**
 * Fallback for the core set: the 27 Lucide names Dynamic's components resolve
 * on their own, without the widget ever mentioning them.
 *
 * Used when the installed `@dynamic-framework/ui-react` does not publish
 * `dist/icons-core.json` (2.8.0 and 2.9.0 do not). The list was derived by
 * walking ui-react 2.8.0's components for the names that reach
 * `DIcon`/`DIconBase` without the widget mentioning them: the X in `DAlert`,
 * the chevrons in `DCollapse`, the eye in `DInputPassword`, and so on. The test
 * "los 27 nombres del respaldo existen en el lucide-react instalado" checks
 * that they all remain valid Lucide exports.
 *
 * If Dynamic adds an internal icon in a future version and the package still
 * does not publish the JSON, that icon will be missing: add it here or pass it
 * through `include`.
 */
const CORE_ICONS_FALLBACK = [
  // Path 1 -- iconMap defaults in DContextProvider (17)
  'X',
  'ChevronUp',
  'ChevronDown',
  'ChevronLeft',
  'ChevronRight',
  'Upload',
  'Calendar',
  'Check',
  'AlertCircle',
  'AlertTriangle',
  'CheckCircle',
  'Info',
  'Search',
  'Eye',
  'EyeOff',
  'Plus',
  'Minus',
  // Path 2 -- names hardcoded in the components' JSX (10)
  'MoreVertical',
  'Paperclip',
  'Trash',
  'RefreshCw',
  'FileText',
  'Share2',
  'Download',
  'CircleCheckBig',
  'CircleCheck',
  'Circle',
];

/** Props of Dynamic's components that take an icon name. */
const ICON_PROPS = new Set(['icon', 'iconStart', 'iconEnd']);

export type LucideSubsetOptions = {
  /**
   * Icon names the widget resolves at runtime and that do not appear as a
   * string literal in `src/**` (for instance, ones arriving from the Modyo API
   * or from a content JSON).
   *
   * Rarely needed: the source scan collects EVERY literal in `src/**`, so
   * declaring the names in a constant in your own code is already enough. See
   * the README.
   */
  include?: string[];
  /**
   * When `true`, fails the build if it finds an icon prop with a non-literal
   * expression (`icon={something}`) in `src/**` and `include` contributes no
   * valid icon name -- either because it is empty, or because every name in it
   * was rejected for not being a Lucide export.
   *
   * For projects that want a guarantee that no icon is dropped silently.
   * Defaults to `false`, because the template itself has two legitimate
   * wrappers (`MyLink`, `EmptyState`) whose names do appear as literals in the
   * code calling them.
   */
  strict?: boolean;
  /** Turns the plugin off entirely, leaving the full Lucide in the bundle. */
  disabled?: boolean;
};

export type IconSourceScan = {
  /** Every string literal found. */
  literals: Set<string>;
  /** Icon props holding a non-literal expression, for `strict` mode. */
  dynamicSites: Array<{ file: string; line: number; prop: string; text: string }>;
};

/**
 * Collects the string literals of a TS/TSX file using the TypeScript parser,
 * and records the icon props whose value is not a literal.
 *
 * It collects EVERY literal, not only those in JSX attribute position:
 * wrappers like `MyLink` receive the name through a prop, so the literal lives
 * at the call site (`<MyLink icon="Book" />`) and sometimes inside an array or
 * a map of constants. Filtering by position would miss those cases.
 *
 * False positives (a string that happens to match an icon name) are
 * acceptable: they cost one extra icon in the bundle.
 */
export function scanSource(code: string, file: string): IconSourceScan {
  const literals = new Set<string>();
  const dynamicSites: IconSourceScan['dynamicSites'] = [];
  const sourceFile = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const lineOf = (node: ts.Node) => (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      literals.add(node.text);
    }

    // Icon prop holding an expression: `icon={something}`. An `icon={'Book'}`
    // counts as a literal, not as a dynamic site.
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && ICON_PROPS.has(node.name.text)) {
      const { initializer } = node;
      if (initializer && ts.isJsxExpression(initializer)) {
        const inner = initializer.expression;
        const isLiteral = inner
          && (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner));
        if (!isLiteral) {
          dynamicSites.push({
            file,
            line: lineOf(node),
            prop: node.name.text,
            text: node.getText(sourceFile).replace(/\s+/g, ' ').trim(),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { literals, dynamicSites };
}

/** Walks a directory and returns the paths of its .ts/.tsx files. */
export function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * Builds the export name -> icon file map by reading Lucide's ESM index with
 * the TypeScript parser.
 *
 * Deliberately not derived from a PascalCase -> kebab transformation. The index
 * is the source of truth for which aliases exist, and the transformation breaks
 * at letter/digit boundaries: `Share2` should yield `share-2.js` and yields
 * `share2.js`, which does not exist. Four of the 27 core names are deprecated
 * aliases (`AlertCircle` -> `circle-alert.js`) that cannot be derived from the
 * name either.
 */
export function buildIconFileMap(indexCode: string, indexFile = 'lucide-react.js'): Map<string, string> {
  const map = new Map<string, string>();
  const sourceFile = ts.createSourceFile(indexFile, indexCode, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const { moduleSpecifier, exportClause } = statement;
    // `export { index as icons };` has no moduleSpecifier: skip it.
    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) continue;
    if (!exportClause || !ts.isNamedExports(exportClause)) continue;

    for (const specifier of exportClause.elements) {
      // Only `export { default as Name } from './...'` is of interest.
      if (!specifier.propertyName || specifier.propertyName.text !== 'default') continue;
      map.set(specifier.name.text, moduleSpecifier.text);
    }
  }

  return map;
}

export type LucidePaths = {
  packageDir: string;
  esmDir: string;
  indexFile: string;
  version: string;
};

/**
 * Locates the `lucide-react` that `@dynamic-framework/ui-react` would resolve.
 *
 * Resolution starts from ui-react's `package.json`, not from the project root,
 * so a nested copy at
 * `node_modules/@dynamic-framework/ui-react/node_modules/lucide-react` is found
 * too, which is what happens when version ranges prevent hoisting it.
 *
 * It resolves `lucide-react/package.json` rather than the bare specifier
 * because `lucide-react` declares no `exports` and its `main` points at
 * `dist/cjs`: asking for the package would return CommonJS, and what is needed
 * are the per-icon ESM modules.
 */
export function resolveLucidePaths(root: string, uiReactDir: string): LucidePaths {
  const uiReactPkg = path.join(uiReactDir, 'package.json');
  const from = fs.existsSync(uiReactPkg) ? uiReactPkg : path.join(root, 'package.json');
  const pkgJsonPath = createRequire(from).resolve(`${LUCIDE_SPECIFIER}/package.json`);
  const packageDir = path.dirname(pkgJsonPath);
  const esmDir = path.join(packageDir, 'dist', 'esm');
  const indexFile = path.join(esmDir, 'lucide-react.js');
  if (!fs.existsSync(indexFile)) {
    throw new Error(`[lucide-subset] no se encontro el indice ESM de lucide-react en ${indexFile}`);
  }
  const version = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version as string;
  return { packageDir, esmDir, indexFile, version };
}

/**
 * Normalizes an externally supplied list of icon names: trims each entry, drops
 * the blank ones, and removes duplicates.
 *
 * Both lists it is applied to come from outside this file -- `include` is
 * hand-written in vite.config.ts, and the core set is read from the installed
 * package's dist/icons-core.json -- so neither is guaranteed to be tidy. A
 * blank entry can never match an icon and used to be reported as an omitted
 * name, which rendered the warning as a stray comma; a padded entry like
 * `'Book '` never matched the real export either.
 */
export function normalizeNames(names: string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter((name) => name !== ''))];
}

/** Locates the directory of the installed @dynamic-framework/ui-react. */
export function resolveUiReactDir(root: string): string {
  const pkgJsonPath = createRequire(path.join(root, 'package.json'))
    .resolve('@dynamic-framework/ui-react/package.json');
  return path.dirname(pkgJsonPath);
}

export type CoreIcons = {
  names: string[];
  source: 'package' | 'fallback';
};

/**
 * Reads the core set from `dist/icons-core.json` of the installed ui-react.
 *
 * Two shapes are accepted, because the file does not yet exist in any
 * published version and its final shape is not settled: an array of strings,
 * or an object with an `icons` key. If it is missing or unreadable, this falls
 * back to the embedded list.
 */
export function loadCoreIcons(uiReactDir: string): CoreIcons {
  const jsonPath = path.join(uiReactDir, 'dist', 'icons-core.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const names = Array.isArray(parsed) ? parsed : parsed?.icons;
      if (Array.isArray(names) && names.every((n) => typeof n === 'string') && names.length > 0) {
        return { names: [...names], source: 'package' };
      }
    } catch {
      // Unexpected shape: fall back to the embedded list and warn from the plugin.
    }
  }
  return { names: [...CORE_ICONS_FALLBACK], source: 'fallback' };
}

export type IconManifest = {
  included: string[];
  fromSource: string[];
  fromCore: string[];
  fromInclude: string[];
  coreSource: 'package' | 'fallback';
  lucideReact: string;
};

export default function lucideSubset(options: LucideSubsetOptions = {}): Plugin {
  const { include = [], strict = false, disabled = false } = options;

  let root = process.cwd();
  let paths: LucidePaths;
  let iconFileMap: Map<string, string>;
  let manifest: IconManifest;
  let unknownIncluded: string[] = [];

  return {
    name: 'lucide-subset',
    apply: 'build',
    // `pre` is required: the internal vite:resolve plugin also answers the
    // `lucide-react` specifier, and in resolveId the first one to answer
    // wins.
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      if (disabled) return;

      const uiReactDir = resolveUiReactDir(root);
      paths = resolveLucidePaths(root, uiReactDir);
      iconFileMap = buildIconFileMap(fs.readFileSync(paths.indexFile, 'utf8'), paths.indexFile);

      // 1. Scan of the widget's own code.
      const srcDir = path.join(root, 'src');
      const literals = new Set<string>();
      const dynamicSites: IconSourceScan['dynamicSites'] = [];
      for (const file of listSourceFiles(srcDir)) {
        const scan = scanSource(fs.readFileSync(file, 'utf8'), path.relative(root, file));
        for (const literal of scan.literals) literals.add(literal);
        dynamicSites.push(...scan.dynamicSites);
      }
      const fromSource = [...literals].filter((name) => iconFileMap.has(name)).sort();

      // 2. Dynamic's core.
      const core = loadCoreIcons(uiReactDir);
      // Normalized before filtering: neither list is guaranteed to be tidy.
      // `included` is a Set already, so a repeat could never reach the virtual
      // module, but an untidy entry would show up in icons-manifest.json -- the
      // artifact the README tells you to read -- and in the warnings below.
      const coreNames = normalizeNames(core.names);
      if (core.source === 'fallback') {
        this.warn(
          `usando la lista de respaldo del nucleo (${core.names.length} iconos): `
          + `@dynamic-framework/ui-react no publica dist/icons-core.json. `
          + 'Si una version futura agrega iconos internos, hay que actualizar '
          + 'CORE_ICONS_FALLBACK en .vite/plugins/lucideSubset.ts o pasarlos por include.',
        );
      }
      const fromCore = coreNames.filter((name) => iconFileMap.has(name)).sort();
      const missingCore = coreNames.filter((name) => !iconFileMap.has(name));
      if (missingCore.length > 0) {
        this.warn(
          `estos nombres del nucleo no existen en lucide-react@${paths.version} `
          + `y se omiten: ${missingCore.join(', ')}`,
        );
      }

      // 3. Manually declared names.
      const includeNames = normalizeNames(include);
      const fromInclude = includeNames.filter((name) => iconFileMap.has(name)).sort();
      unknownIncluded = includeNames.filter((name) => !iconFileMap.has(name));
      if (unknownIncluded.length > 0) {
        this.warn(
          `estos nombres de "include" no son exports de lucide-react@${paths.version} `
          + `y se omiten: ${unknownIncluded.join(', ')}`,
        );
      }

      // La condicion es fromInclude, no include: un `include` con nombres que
      // no son exports de Lucide se filtra entero y deja el conjunto sin
      // determinar igual que un `include` vacio. Mirar include.length dejaba
      // pasar el build con include: ['NoExiste'] o include: [''].
      if (strict && dynamicSites.length > 0 && fromInclude.length === 0) {
        const detail = dynamicSites
          .map((site) => `  ${site.file}:${site.line}  ${site.text}`)
          .join('\n');
        this.error(
          'strict: hay props de icono con expresion no literal y "include" no aporta '
          + 'ningun nombre valido de icono, asi que esos iconos no se pueden determinar '
          + 'en tiempo de build:\n'
          + `${detail}\n`
          + 'Declara los nombres posibles en la opcion "include" del plugin, ponlos como '
          + 'string literal en src/, o desactiva strict.',
        );
      }

      const included = [...new Set([...fromSource, ...fromCore, ...fromInclude])].sort();
      manifest = {
        included,
        fromSource,
        fromCore,
        fromInclude,
        coreSource: core.source,
        lucideReact: paths.version,
      };
    },

    resolveId(source, importer) {
      if (disabled) return null;
      if (source !== LUCIDE_SPECIFIER || !importer) return null;

      // Importer guard: Lucide is only substituted for Dynamic's code. A
      // widget importing icons directly
      // (`import { Rocket } from 'lucide-react'`) still sees the real package,
      // and therefore does not break.
      //
      // The alternative would be aliasing `lucide-react` globally in
      // resolve.alias, but that would hit the widget too and would create a
      // cycle: an alias is a prefix substitution blind to the importer, so a
      // virtual module reexporting from 'lucide-react' would resolve to
      // itself. No cycle is possible here because the virtual module reexports
      // by absolute path, never going back to the bare specifier.
      const uiReactDir = resolveUiReactDir(root);
      const normalized = importer.split(path.sep).join('/');
      const uiReactPrefix = `${uiReactDir.split(path.sep).join('/')}/`;
      if (!normalized.startsWith(uiReactPrefix)) return null;

      return RESOLVED_VIRTUAL_ID;
    },

    load(id) {
      if (disabled || id !== RESOLVED_VIRTUAL_ID) return null;

      const lines = [
        '// Generado por .vite/plugins/lucideSubset.ts — no editar.',
        `// ${manifest.included.length} iconos de lucide-react@${manifest.lucideReact}.`,
        '',
      ];

      // A name must not be exported twice: the virtual module would be
      // invalid JS and rollup aborts with `Duplicate export "X"`. `Icon` and
      // `createLucideIcon` are in iconFileMap, so they can come in through
      // `included` -- via `include`, or via a string literal in src/ matching
      // their name -- and come out again in NON_ICON_EXPORTS.
      const exported = new Set<string>();
      const addExport = (name: string, relativeFile: string) => {
        if (exported.has(name)) return;
        exported.add(name);
        // Absolute path to the ESM module. Avoids the bare specifier (which
        // would resolve to CJS) and any cycle with this same plugin.
        const absolute = path.resolve(paths.esmDir, relativeFile).split(path.sep).join('/');
        lines.push(`export { default as ${name} } from ${JSON.stringify(absolute)};`);
      };

      for (const name of manifest.included) addExport(name, iconFileMap.get(name)!);

      // Index exports that are not icons, so the namespace handed to ui-react
      // has no holes.
      for (const name of NON_ICON_EXPORTS) {
        const relativeFile = iconFileMap.get(name);
        if (!relativeFile) continue;
        addExport(name, relativeFile);
      }

      return `${lines.join('\n')}\n`;
    },

    generateBundle() {
      if (disabled) return;
      this.emitFile({
        type: 'asset',
        fileName: 'icons-manifest.json',
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
    },
  };
}
