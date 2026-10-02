import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import type { Plugin } from 'vite';

/**
 * Sustituye el módulo `lucide-react` que importa @dynamic-framework/ui-react
 * por un módulo virtual que solo reexporta los iconos que necesita este widget.
 *
 * El problema: `ui-react` resuelve los iconos con `import * as LucideIcons from
 * 'lucide-react'` y luego, dentro de `DIconBase`, `const icons = LucideIcons`
 * seguido de `icons[name]`. Ese acceso dinámico anula el tree-shaking, así que
 * el bundle arrastra el catálogo completo de Lucide (más de 1,6k módulos de
 * iconos) para pintar unos pocos.
 *
 * Ojo con el nombre: ese `icons` es el objeto namespace del módulo, no el export
 * `icons` del índice de Lucide, que es otra cosa (ver NON_ICON_EXPORTS).
 *
 * La solución: interceptar el especificador `lucide-react` SOLO cuando el
 * importador vive dentro de `@dynamic-framework/ui-react`, y servirle un módulo
 * con los N iconos que de verdad se necesitan. `ui-react` recibe entonces un
 * objeto namespace con N entradas en vez de miles, y ese `icons[name]` sigue
 * funcionando: la librería no necesita cambios.
 *
 * N es la unión de tres conjuntos:
 *  1. Catastro del código: todo string literal en posición de valor de `src/**`
 *     que coincida con un export real de Lucide.
 *  2. Núcleo: los nombres que los propios componentes de Dynamic resuelven por
 *     dentro (`DAlert`, `DCollapse`, `DInputPassword`, ...).
 *  3. `include`: nombres que el widget calcula en tiempo de ejecución y que, por
 *     tanto, nunca aparecen como literal en ninguna parte.
 *
 * Solo en build (`apply: 'build'`), como escapeLiquidInStrings. Con `vite dev`
 * y con el preview de Modyo CLI el widget ve Lucide completo, que es lo que
 * quieres mientras iteras: cualquier nombre funciona.
 */

const VIRTUAL_ID = 'virtual:lucide-subset';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;
const LUCIDE_SPECIFIER = 'lucide-react';

/**
 * Exports del índice de Lucide que no son iconos. Se incluyen siempre en el
 * módulo virtual para que el namespace que recibe `ui-react` conserve todo lo
 * que no es un icono. Pesan unos pocos bytes.
 *
 * El export `icons` del índice queda fuera a propósito, y no hay que confundirlo
 * con el `const icons = LucideIcons` de `DIconBase`: este último es el objeto
 * namespace del módulo; el primero es un mapa con el catálogo entero
 * (`export { index as icons }` en el índice ESM), y reintroducirlo anularía todo
 * el sentido del plugin.
 */
const NON_ICON_EXPORTS = ['createLucideIcon', 'Icon'];

/**
 * Respaldo del conjunto del núcleo: los 27 nombres de Lucide que los
 * componentes de Dynamic resuelven por su cuenta, sin que el widget los
 * mencione nunca.
 *
 * Se usa cuando el `@dynamic-framework/ui-react` instalado no publica
 * `dist/icons-core.json` (2.8.0 y 2.9.0 no lo publican). La lista se obtuvo
 * recorriendo los componentes de ui-react 2.8.0 en busca de los nombres que
 * llegan a `DIcon`/`DIconBase` sin que el widget los mencione: la X de `DAlert`,
 * los chevrons de `DCollapse`, el ojo de `DInputPassword`, etc. El test
 * "los 27 nombres del respaldo existen en el lucide-react instalado" comprueba
 * que todos siguen siendo exports válidos de Lucide.
 *
 * Si Dynamic agrega un icono interno en una versión futura y el paquete sigue
 * sin publicar el JSON, ese icono faltará: agrégalo aquí o pásalo por
 * `include`.
 */
const CORE_ICONS_FALLBACK = [
  // Vía 1 -- valores por defecto de iconMap en DContextProvider (17)
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
  // Vía 2 -- nombres fijos en el JSX de los componentes (10)
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
   * Nombres de icono que el widget resuelve en tiempo de ejecución y que no
   * aparecen como string literal en `src/**` (por ejemplo, los que llegan desde
   * la API de Modyo o desde un JSON de contenido).
   *
   * Rara vez hace falta: el catastro del código recoge todos los literales de
   * valor de `src/**`, así que declarar los nombres en una constante de tu
   * propio código ya basta. Ver el README.
   */
  include?: string[];
  /**
   * Con `true`, hace fallar el build si encuentra una prop de icono con una
   * expresión no literal (`icon={algo}`) en `src/**` e `include` no aporta
   * ningún nombre de icono válido -- ya sea porque está vacío o porque todos sus
   * nombres se rechazaron por no ser exports de Lucide.
   *
   * Para proyectos que quieren la garantía de que ningún icono se pierde en
   * silencio. Por defecto es `false`, porque el propio template tiene dos
   * envoltorios legítimos (`MyLink`, `EmptyState`) cuyos nombres sí aparecen
   * como literales en el código que los llama.
   */
  strict?: boolean;
  /** Desactiva el plugin por completo y deja Lucide entero en el bundle. */
  disabled?: boolean;
};

export type IconSourceScan = {
  /** Todos los string literals encontrados en posición de valor. */
  literals: Set<string>;
  /** Props de icono con una expresión no literal, para el modo `strict`. */
  dynamicSites: Array<{ file: string; line: number; prop: string; text: string }>;
};

/**
 * Recoge los string literals de un archivo TS/TSX con el parser de TypeScript
 * y anota las props de icono cuyo valor no es un literal.
 *
 * Recoge todo literal en posición de valor, no solo los que están en posición
 * de atributo JSX: los envoltorios como `MyLink` reciben el nombre por una prop,
 * así que el literal vive en el sitio de llamada (`<MyLink icon="Book" />`) y a
 * veces dentro de un array o de un mapa de constantes.
 *
 * Omite los literales que nunca pueden llegar a un icono en tiempo de
 * ejecución. Para decidirlo sube por los ancestros del literal y lo descarta
 * cuando alguno es un nodo de tipo (`T['Filter']`, `Record<'Rocket', number>`,
 * `'asc' | 'desc'`, `type T = { 'Rocket': string }`) o una `interface`, cuando
 * el literal está dentro del inicializador de un miembro de `enum` (también
 * entre paréntesis), o cuando es el nombre de un `declare module`, el
 * especificador de módulo de un `import` o de un `export ... from`, o el
 * argumento de un `import x = require(...)`. El recorrido se detiene en la
 * primera sentencia o bloque. La excepción es la cláusula `extends` de una
 * clase (`class A extends withIcon('Rocket') {}`): TypeScript la clasifica como
 * nodo de tipo, pero se ejecuta en tiempo de ejecución y sus literales cuentan.
 *
 * Los falsos positivos (un string que coincide por casualidad con un nombre de
 * icono) son aceptables: cuestan un icono de más en el bundle.
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

  const isOutsideValuePosition = (node: ts.StringLiteralLike) => {
    let child: ts.Node = node;
    for (let current = node.parent; current; child = current, current = current.parent) {
      if (ts.isTypeNode(current) && !ts.isExpressionWithTypeArguments(current)) return true;
      if (ts.isInterfaceDeclaration(current)) return true;
      if (ts.isExternalModuleReference(current)) return true;
      if (ts.isEnumMember(current) && current.initializer === child) return true;
      if (ts.isModuleDeclaration(current) && current.name === child) return true;
      if ((ts.isImportDeclaration(current) || ts.isExportDeclaration(current))
        && current.moduleSpecifier === child) return true;
      if (ts.isStatement(current) || ts.isBlock(current)) return false;
    }
    return false;
  };

  const visit = (node: ts.Node) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && !isOutsideValuePosition(node)) {
      literals.add(node.text);
    }

    // Prop de icono con una expresión: `icon={algo}`. Un `icon={'Book'}`
    // cuenta como literal, no como sitio dinámico.
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

/** Recorre un directorio y devuelve las rutas de sus archivos .ts/.tsx. */
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
 * Construye el mapa nombre de export -> archivo de icono leyendo el índice ESM
 * de Lucide con el parser de TypeScript.
 *
 * A propósito no se deriva de una transformación PascalCase -> kebab. El índice
 * es la fuente de verdad sobre qué alias existen, y la transformación falla en
 * las fronteras letra/dígito: `Share2` debería dar `share-2.js` y da
 * `share2.js`, que no existe. Cuatro de los 27 nombres del núcleo son alias
 * deprecados (`AlertCircle` -> `circle-alert.js`) que tampoco se pueden derivar
 * del nombre.
 */
export function buildIconFileMap(indexCode: string, indexFile = 'lucide-react.js'): Map<string, string> {
  const map = new Map<string, string>();
  const sourceFile = ts.createSourceFile(indexFile, indexCode, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const { moduleSpecifier, exportClause } = statement;
    // `export { index as icons };` no tiene moduleSpecifier: se omite.
    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) continue;
    if (!exportClause || !ts.isNamedExports(exportClause)) continue;

    for (const specifier of exportClause.elements) {
      // Solo interesa `export { default as Name } from './...'`.
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
 * Localiza el `lucide-react` que resolvería `@dynamic-framework/ui-react`.
 *
 * La resolución parte del `package.json` de ui-react, no de la raíz del
 * proyecto, así que también se encuentra una copia anidada en
 * `node_modules/@dynamic-framework/ui-react/node_modules/lucide-react`, que es
 * lo que ocurre cuando los rangos de versión impiden elevarla (hoisting).
 *
 * Resuelve `lucide-react/package.json` en vez del especificador desnudo porque
 * `lucide-react` no declara `exports` y su `main` apunta a `dist/cjs`: pedir el
 * paquete devolvería CommonJS, y lo que se necesita son los módulos ESM de cada
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

/**
 * Normaliza una lista de nombres de icono que llega de fuera: recorta cada
 * entrada, descarta las vacías y elimina los duplicados.
 *
 * Las dos listas a las que se aplica vienen de fuera de este archivo --
 * `include` se escribe a mano en vite.config.ts y el conjunto del núcleo se lee
 * de dist/icons-core.json del paquete instalado --, así que ninguna tiene
 * garantía de venir limpia. Una entrada vacía nunca puede coincidir con un icono
 * y antes se informaba como nombre omitido, lo que dejaba en el aviso una coma
 * suelta; una entrada con espacios como `'Book '` tampoco coincidía nunca con el
 * export real.
 */
export function normalizeNames(names: string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter((name) => name !== ''))];
}

/** Localiza el directorio del @dynamic-framework/ui-react instalado. */
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
 * Lee el conjunto del núcleo de `dist/icons-core.json` del ui-react instalado.
 *
 * Se aceptan dos formas, porque el archivo todavía no existe en ninguna versión
 * publicada y su forma final no está decidida: un array de strings o un objeto
 * con una clave `icons`. Si falta o no se puede leer, se recurre a la lista
 * embebida.
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
      // Forma inesperada: se recurre a la lista embebida y el plugin avisa.
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
    // `pre` es obligatorio: el plugin interno vite:resolve también responde al
    // especificador `lucide-react`, y en resolveId gana el primero que
    // responde.
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      if (disabled) return;

      const uiReactDir = resolveUiReactDir(root);
      paths = resolveLucidePaths(root, uiReactDir);
      iconFileMap = buildIconFileMap(fs.readFileSync(paths.indexFile, 'utf8'), paths.indexFile);

      // 1. Catastro del código propio del widget.
      const srcDir = path.join(root, 'src');
      const literals = new Set<string>();
      const dynamicSites: IconSourceScan['dynamicSites'] = [];
      for (const file of listSourceFiles(srcDir)) {
        const scan = scanSource(fs.readFileSync(file, 'utf8'), path.relative(root, file));
        for (const literal of scan.literals) literals.add(literal);
        dynamicSites.push(...scan.dynamicSites);
      }
      const fromSource = [...literals].filter((name) => iconFileMap.has(name)).sort();

      // 2. Núcleo de Dynamic.
      const core = loadCoreIcons(uiReactDir);
      // Se normaliza antes de filtrar: ninguna de las dos listas tiene garantía
      // de venir limpia. `included` ya es un Set, así que una repetición nunca
      // podría llegar al módulo virtual, pero una entrada sin limpiar aparecería
      // en icons-manifest.json -- el artefacto que el README dice que leas -- y
      // en los avisos de abajo.
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

      // 3. Nombres declarados a mano.
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

      // Guarda por importador: Lucide solo se sustituye para el código de
      // Dynamic. Un widget que importa iconos directamente
      // (`import { Rocket } from 'lucide-react'`) sigue viendo el paquete real
      // y, por tanto, no se rompe.
      //
      // La alternativa sería un alias global de `lucide-react` en
      // resolve.alias, pero alcanzaría también al widget y crearía un ciclo:
      // un alias es una sustitución de prefijo que no mira al importador, así
      // que un módulo virtual que reexporta desde 'lucide-react' se resolvería
      // a sí mismo. Aquí no hay ciclo posible porque el módulo virtual
      // reexporta por ruta absoluta y nunca vuelve al especificador desnudo.
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

      // Un nombre no se puede exportar dos veces: el módulo virtual sería JS
      // inválido y rollup aborta con `Duplicate export "X"`. `Icon` y
      // `createLucideIcon` están en iconFileMap, así que pueden entrar por
      // `included` -- vía `include` o vía un string literal de src/ que
      // coincida con su nombre -- y volver a salir en NON_ICON_EXPORTS.
      const exported = new Set<string>();
      const addExport = (name: string, relativeFile: string) => {
        if (exported.has(name)) return;
        exported.add(name);
        // Ruta absoluta al módulo ESM. Evita el especificador desnudo (que
        // resolvería a CJS) y cualquier ciclo con este mismo plugin.
        const absolute = path.resolve(paths.esmDir, relativeFile).split(path.sep).join('/');
        lines.push(`export { default as ${name} } from ${JSON.stringify(absolute)};`);
      };

      for (const name of manifest.included) addExport(name, iconFileMap.get(name)!);

      // Exports del índice que no son iconos, para que el namespace que recibe
      // ui-react no tenga huecos.
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
