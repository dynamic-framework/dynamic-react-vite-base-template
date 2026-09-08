import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import type { Plugin } from 'vite';

/**
 * Sustituye el modulo `lucide-react` que importa @dynamic-framework/ui-react por
 * un modulo virtual que solo reexporta los iconos que este widget necesita.
 *
 * El problema: `ui-react` resuelve iconos con `import * as LucideIcons from
 * 'lucide-react'` y luego `icons[nombre]`. Ese acceso dinamico impide el
 * tree-shaking, asi que el bundle se lleva el catalogo completo de Lucide
 * (1 648 modulos de icono) para pintar un punado.
 *
 * La solucion: interceptar el especificador `lucide-react` SOLO cuando quien lo
 * importa vive dentro de `@dynamic-framework/ui-react`, y servirle un modulo
 * con los N iconos que hacen falta. El objeto namespace que ve `ui-react` pasa a
 * tener N entradas en vez de miles, y `icons[nombre]` sigue funcionando igual:
 * no hay que tocar la biblioteca.
 *
 * Los N se calculan como la union de tres conjuntos:
 *  1. Catastro: todos los string literals de `src/**` que coincidan con un
 *     export real de Lucide.
 *  2. Nucleo: los nombres que los propios componentes de Dynamic usan por
 *     dentro (`DAlert`, `DCollapse`, `DInputPassword`, ...).
 *  3. `include`: nombres que el widget calcula en tiempo de ejecucion y que por
 *     tanto no aparecen como literal en ninguna parte.
 *
 * Solo actua en `build` (`apply: 'build'`), igual que escapeLiquidInStrings. En
 * `vite dev` y en el preview del CLI de Modyo el widget ve Lucide completo, que
 * es lo deseable mientras se itera: cualquier nombre funciona.
 */

const VIRTUAL_ID = 'virtual:lucide-subset';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;
const LUCIDE_SPECIFIER = 'lucide-react';

/**
 * Exports del indice de Lucide que no son iconos. Se incluyen siempre en el
 * modulo virtual para que el namespace que ve `ui-react` no pierda nada que no
 * sea un icono. Pesan unos pocos bytes.
 *
 * `icons` queda fuera a proposito: es el namespace de los 1 648 iconos
 * (`export { index as icons }` en el indice ESM) y reintroducirlo anularia todo
 * el efecto del plugin.
 */
const NON_ICON_EXPORTS = ['createLucideIcon', 'Icon'];

/**
 * Respaldo del conjunto nucleo: los 27 nombres de Lucide que los componentes de
 * Dynamic resuelven por su cuenta, sin que el widget los mencione.
 *
 * Se usa cuando el `@dynamic-framework/ui-react` instalado no publica
 * `dist/icons-core.json` (2.8.0 y 2.9.0 no lo hacen). Verificado contra
 * ui-react en `origin/develop`; ver _reports/iconos-confirmacion-2026-09-07.md
 * secciones 2.1 a 2.3.
 *
 * Si Dynamic agrega un icono interno en una version futura y el paquete sigue
 * sin publicar el JSON, ese icono faltara: hay que agregarlo aqui o pasarlo por
 * `include`.
 */
const CORE_ICONS_FALLBACK = [
  // Via 1 — defaults de iconMap en DContextProvider (17)
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
  // Via 2 — nombres incrustados en el JSX de los componentes (10)
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

/** Props de los componentes de Dynamic que reciben un nombre de icono. */
const ICON_PROPS = new Set(['icon', 'iconStart', 'iconEnd']);

export type LucideSubsetOptions = {
  /**
   * Nombres de icono que el widget resuelve en tiempo de ejecucion y que no
   * aparecen como string literal en `src/**` (por ejemplo, los que llegan
   * desde la API de Modyo o desde un JSON de contenido).
   *
   * Casi nunca hace falta: el catastro recolecta TODOS los literales de
   * `src/**`, asi que declarar los nombres en una constante del propio codigo
   * ya basta. Ver el README.
   */
  include?: string[];
  /**
   * Si es `true`, falla el build cuando encuentra una prop de icono con una
   * expresion no literal (`icon={algo}`) en `src/**` y `include` esta vacio.
   *
   * Sirve para proyectos que quieran garantizar que ningun icono se pierde en
   * silencio. Por defecto `false`, porque el propio template tiene dos
   * envoltorios legitimos (`MyLink`, `EmptyState`) cuyos nombres si estan como
   * literales en el codigo que los invoca.
   */
  strict?: boolean;
  /** Desactiva el plugin por completo. Deja el bundle con Lucide entero. */
  disabled?: boolean;
};

export type IconSourceScan = {
  /** Todos los string literals encontrados. */
  literals: Set<string>;
  /** Props de icono con expresion no literal, para el modo `strict`. */
  dynamicSites: Array<{ file: string; line: number; prop: string; text: string }>;
};

/**
 * Recolecta los string literals de un archivo TS/TSX usando el parser de
 * TypeScript, y anota las props de icono cuyo valor no es un literal.
 *
 * Recolecta TODOS los literales, no solo los que estan en posicion de atributo
 * JSX: los envoltorios como `MyLink` reciben el nombre por prop, asi que el
 * literal vive en el sitio de llamada (`<MyLink icon="Book" />`) y a veces en
 * un array o un mapa de constantes. Filtrar por posicion perderia esos casos.
 *
 * Los falsos positivos (un string que casualmente se llama igual que un icono)
 * son aceptables: cuestan un icono de mas en el bundle.
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

    // Prop de icono con expresion: `icon={algo}`. Un `icon={'Book'}` cuenta
    // como literal y no como sitio dinamico.
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

/** Recorre un directorio y devuelve las rutas de los archivos .ts/.tsx. */
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
 * Construye el mapa nombre de export -> archivo de icono leyendo el indice ESM
 * de Lucide con el parser de TypeScript.
 *
 * No se deriva de una transformacion PascalCase -> kebab a proposito. El indice
 * es la fuente de verdad de que alias existen, y la transformacion falla en los
 * limites letra/digito: `Share2` deberia dar `share-2.js` y da `share2.js`, que
 * no existe. Cuatro de los 27 nombres del nucleo son alias deprecados
 * (`AlertCircle` -> `circle-alert.js`) que tampoco se derivan del nombre.
 */
export function buildIconFileMap(indexCode: string, indexFile = 'lucide-react.js'): Map<string, string> {
  const map = new Map<string, string>();
  const sourceFile = ts.createSourceFile(indexFile, indexCode, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const { moduleSpecifier, exportClause } = statement;
    // `export { index as icons };` no tiene moduleSpecifier: se ignora.
    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) continue;
    if (!exportClause || !ts.isNamedExports(exportClause)) continue;

    for (const specifier of exportClause.elements) {
      // Solo interesa `export { default as Nombre } from './...'`.
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
 * Ubica el `lucide-react` que resolveria `@dynamic-framework/ui-react`.
 *
 * Se resuelve desde el `package.json` de ui-react, no desde la raiz del
 * proyecto: asi se encuentra tambien una copia anidada en
 * `node_modules/@dynamic-framework/ui-react/node_modules/lucide-react`, que es
 * lo que ocurre si los rangos de version no permiten izarla.
 *
 * Se resuelve `lucide-react/package.json` y no el especificador desnudo porque
 * `lucide-react` no declara `exports` y su `main` apunta a `dist/cjs`: pedir el
 * paquete devolveria CommonJS, y lo que hace falta son los modulos ESM por
 * icono.
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

/** Ubica el directorio del @dynamic-framework/ui-react instalado. */
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
 * Lee el conjunto nucleo de `dist/icons-core.json` del ui-react instalado.
 *
 * Acepta dos formas, porque el archivo todavia no existe en ninguna version
 * publicada y su forma final no esta fijada: un array de strings, o un objeto
 * con la clave `icons`. Si no existe o no se puede leer, cae al respaldo
 * embebido.
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
      // Formato inesperado: se usa el respaldo y se avisa desde el plugin.
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
    // `pre` es necesario: el plugin interno vite:resolve tambien responde al
    // especificador `lucide-react`, y en resolveId gana el primero que
    // contesta.
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      if (disabled) return;

      const uiReactDir = resolveUiReactDir(root);
      paths = resolveLucidePaths(root, uiReactDir);
      iconFileMap = buildIconFileMap(fs.readFileSync(paths.indexFile, 'utf8'), paths.indexFile);

      // 1. Catastro del codigo del widget.
      const srcDir = path.join(root, 'src');
      const literals = new Set<string>();
      const dynamicSites: IconSourceScan['dynamicSites'] = [];
      for (const file of listSourceFiles(srcDir)) {
        const scan = scanSource(fs.readFileSync(file, 'utf8'), path.relative(root, file));
        for (const literal of scan.literals) literals.add(literal);
        dynamicSites.push(...scan.dynamicSites);
      }
      const fromSource = [...literals].filter((name) => iconFileMap.has(name)).sort();

      // 2. Nucleo de Dynamic.
      const core = loadCoreIcons(uiReactDir);
      if (core.source === 'fallback') {
        this.warn(
          `usando la lista de respaldo del nucleo (${core.names.length} iconos): `
          + `@dynamic-framework/ui-react no publica dist/icons-core.json. `
          + 'Si una version futura agrega iconos internos, hay que actualizar '
          + 'CORE_ICONS_FALLBACK en .vite/plugins/lucideSubset.ts o pasarlos por include.',
        );
      }
      const fromCore = core.names.filter((name) => iconFileMap.has(name)).sort();
      const missingCore = core.names.filter((name) => !iconFileMap.has(name));
      if (missingCore.length > 0) {
        this.warn(
          `estos nombres del nucleo no existen en lucide-react@${paths.version} `
          + `y se omiten: ${missingCore.join(', ')}`,
        );
      }

      // 3. Nombres declarados a mano.
      const fromInclude = include.filter((name) => iconFileMap.has(name)).sort();
      unknownIncluded = include.filter((name) => !iconFileMap.has(name));
      if (unknownIncluded.length > 0) {
        this.warn(
          `estos nombres de "include" no son exports de lucide-react@${paths.version} `
          + `y se omiten: ${unknownIncluded.join(', ')}`,
        );
      }

      if (strict && dynamicSites.length > 0 && include.length === 0) {
        const detail = dynamicSites
          .map((site) => `  ${site.file}:${site.line}  ${site.text}`)
          .join('\n');
        this.error(
          'strict: hay props de icono con expresion no literal y "include" esta vacio, '
          + 'asi que esos iconos no se pueden determinar en tiempo de build:\n'
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

      // Guarda por importador: solo se sustituye Lucide para el codigo de
      // Dynamic. Un widget que importe iconos directamente
      // (`import { Rocket } from 'lucide-react'`) sigue viendo el paquete real,
      // y por tanto no se rompe.
      //
      // La alternativa seria aliasar `lucide-react` globalmente en
      // resolve.alias, pero eso afectaria tambien al widget y crearia un ciclo:
      // el alias es una sustitucion de prefijo indiferente al importador, asi
      // que un modulo virtual que reexportara desde 'lucide-react' se
      // resolveria a si mismo. Aqui no hay ciclo posible porque el modulo
      // virtual reexporta por ruta absoluta, sin volver al especificador
      // desnudo.
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

      for (const name of manifest.included) {
        const relativeFile = iconFileMap.get(name)!;
        // Ruta absoluta al modulo ESM del icono. Evita el especificador desnudo
        // (que resolveria a CJS) y cualquier ciclo con este mismo plugin.
        const absolute = path.resolve(paths.esmDir, relativeFile).split(path.sep).join('/');
        lines.push(`export { default as ${name} } from ${JSON.stringify(absolute)};`);
      }

      // Exports del indice que no son iconos, para no dejar huecos en el
      // namespace que ve ui-react.
      for (const name of NON_ICON_EXPORTS) {
        const relativeFile = iconFileMap.get(name);
        if (!relativeFile) continue;
        const absolute = path.resolve(paths.esmDir, relativeFile).split(path.sep).join('/');
        lines.push(`export { default as ${name} } from ${JSON.stringify(absolute)};`);
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
