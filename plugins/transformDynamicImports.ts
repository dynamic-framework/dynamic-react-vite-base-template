import MagicString from 'magic-string';
import type { Plugin, OutputBundle, OutputChunk } from 'rollup';

/**
 * Options for configuring the transformDynamicImports plugin
 */
export interface TransformDynamicImportsOptions {
  /**
   * Function that returns the resource base variable reference for a given widget placeholder
   * @param widPlaceholder - The widget placeholder string (e.g., '{{widget.wid}}')
   * @returns The variable reference string (e.g., 'window["resourceBasePath_{{widget.wid}}"]')
   */
  resourceBaseVar?: (widPlaceholder: string) => string;

  /**
   * Predicate to determine if a chunk should be processed as an entry chunk
   * @param chunk - The output chunk to test
   * @returns true if the chunk should be processed
   */
  entryNamePredicate?: (chunk: OutputChunk) => boolean;

  /**
   * Enable source map generation for transformed code
   * @default false
   */
  enableSourceMap?: boolean;

  /**
   * Widget placeholder used in resource base path
   * @default '{{widget.wid}}'
   */
  widgetPlaceholder?: string;

  /**
   * Pattern for chunk file extension to match
   * @default '.chunk.js'
   */
  chunkFilePattern?: string;

  /**
   * Entry file name pattern to transform static imports from
   * @default 'main.js'
   */
  entryFileName?: string;

  /**
   * Template for static import URL replacement
   * @default '{{site.url}}/widget_manager/{{widget.wid}}/{{widget.version}}.js'
   */
  staticImportUrlTemplate?: string;
}

/**
 * Default resource base variable generator
 * Creates a window-based accessor with SSR safety
 */
const defaultResourceBaseVar = (widPlaceholder: string): string => {
  return `window['resourceBasePath-${widPlaceholder}']`;
};

/**
 * Default entry name predicate
 * Uses Rollup's isEntry property to identify entry chunks
 */
const defaultEntryNamePredicate = (chunk: OutputChunk): boolean => {
  return chunk.isEntry || false;
};

/**
 * Vite plugin that transforms dynamic imports to use runtime-configurable base paths
 * 
 * This plugin addresses several issues with naive string-based import path rewriting:
 * - Robust regex patterns that handle single/double/backtick quotes and whitespace
 * - Entry chunk detection using chunk.isEntry rather than hardcoded filenames
 * - SSR-safe window access with typeof guards
 * - Optional source map preservation using MagicString
 * - Configurable resource base path variable names
 * - Logging and warnings for observability
 * 
 * @param options - Configuration options for the plugin
 * @returns A Rollup/Vite plugin
 */
export function transformDynamicImports(
  options: TransformDynamicImportsOptions = {}
): Plugin {
  const {
    resourceBaseVar = defaultResourceBaseVar,
    entryNamePredicate = defaultEntryNamePredicate,
    enableSourceMap = false,
    widgetPlaceholder = '{{widget.wid}}',
    chunkFilePattern = '.chunk.js',
    entryFileName = 'main.js',
    staticImportUrlTemplate = '{{site.url}}/widget_manager/{{widget.wid}}/{{widget.version}}.js',
  } = options;

  return {
    name: 'transform-dynamic-imports',
    
    generateBundle(_outputOptions, bundle: OutputBundle) {
      let totalTransformations = 0;
      
      // Process each chunk in the bundle
      for (const [fileName, chunkOrAsset] of Object.entries(bundle)) {
        // Only process JavaScript chunks, not assets
        if (chunkOrAsset.type !== 'chunk') {
          continue;
        }

        const chunk = chunkOrAsset as OutputChunk;
        let transformCount = 0;
        const s = new MagicString(chunk.code);
        
        // Pattern 1: Transform dynamic imports in entry chunks
        // Only process entry chunks for dynamic import transformation
        if (entryNamePredicate(chunk)) {
          // Transform dynamic imports like import("./file.chunk.js")
          // This regex handles:
          // - Single quotes, double quotes, or backticks
          // - Optional whitespace around the path
          // - Captures the quote type to ensure matching pairs
          // Escape special regex characters in chunkFilePattern
          const escapedChunkPattern = chunkFilePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const dynamicImportRegex = new RegExp(
            `import\\(\\s*([\\x60'"])(\\.\\/[^\\x60'"()]+?${escapedChunkPattern})\\1\\s*\\)`,
            'g'
          );
          
          let match: RegExpExecArray | null;
          while ((match = dynamicImportRegex.exec(chunk.code)) !== null) {
            const fullMatch = match[0];
            const quote = match[1];
            const chunkPath = match[2];
            const chunkName = chunkPath.replace('./', '');
            
            // Generate SSR-safe replacement
            // Uses typeof guard to prevent window access in SSR contexts
            // TODO: Add sanitization/validation for resourceBasePath at runtime to prevent 
            // path traversal attacks if the global variable can be user-influenced.
            // Consider implementing: path normalization, allowlist checking, or CSP headers.
            const resourceBaseRef = resourceBaseVar(widgetPlaceholder);
            const replacement = `import(((typeof window !== 'undefined' && window) ? ${resourceBaseRef} : '') + ${quote}${chunkName}${quote})`;
            
            s.overwrite(match.index, match.index + fullMatch.length, replacement);
            transformCount++;
          }
        }

        // Pattern 2: Transform static imports from entry file in chunk files
        // Process all chunk files (not just entry) to transform imports from main.js
        if (fileName.includes(chunkFilePattern)) {
          // Matches: from "./main.js", from './main.js', from `./main.js`
          // Handles optional whitespace between 'from' and the quote
          // Escape special regex characters in entryFileName
          const escapedEntryFile = entryFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const staticImportRegex = new RegExp(
            `from\\s*([\\x60'"])\\.\\/${escapedEntryFile}\\1`,
            'g'
          );
          
          let match: RegExpExecArray | null;
          while ((match = staticImportRegex.exec(chunk.code)) !== null) {
            const fullMatch = match[0];
            const quote = match[1];
            
            // Replace with templated URL for widget versioning
            const replacement = `from ${quote}${staticImportUrlTemplate}${quote}`;
            
            s.overwrite(match.index, match.index + fullMatch.length, replacement);
            transformCount++;
          }
        }

        // If we made any transformations, update the chunk
        if (transformCount > 0) {
          chunk.code = s.toString();
          totalTransformations += transformCount;
          
          // Optionally regenerate source map
          if (enableSourceMap && chunk.map) {
            const map = s.generateMap({
              source: fileName,
              includeContent: true,
              hires: true,
            });
            // MagicString's SourceMap is compatible with Rollup's SourceMap
            chunk.map = map as unknown as typeof chunk.map;
          }
          
          this.warn(
            `Transformed ${transformCount} import(s) in ${fileName}`
          );
        }
      }
      
      if (totalTransformations === 0) {
        this.warn(
          'No dynamic imports were transformed. This may be expected if there are no code-split chunks, ' +
          'or it could indicate that the regex patterns do not match the generated code.'
        );
      } else {
        this.warn(
          `Total transformations applied: ${totalTransformations}`
        );
      }
    },
  };
}

export default transformDynamicImports;
