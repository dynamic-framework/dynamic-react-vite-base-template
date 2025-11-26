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
}

/**
 * Default resource base variable generator
 * Creates a window-based accessor with SSR safety
 */
const defaultResourceBaseVar = (widPlaceholder: string): string => {
  return `window["resourceBasePath_${widPlaceholder}"]`;
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
        
        // Skip non-entry chunks unless custom predicate says otherwise
        if (!entryNamePredicate(chunk)) {
          continue;
        }

        let transformCount = 0;
        const s = new MagicString(chunk.code);
        
        // Pattern 1: Transform dynamic imports like import("./file.chunk.js")
        // This regex handles:
        // - Single quotes, double quotes, or backticks
        // - Optional whitespace around the path
        // - Captures the quote type to ensure matching pairs
        const dynamicImportRegex = /import\(\s*([`'"])(\.\/[^`'"()]+?\.chunk\.js)\1\s*\)/g;
        
        let match: RegExpExecArray | null;
        while ((match = dynamicImportRegex.exec(chunk.code)) !== null) {
          const fullMatch = match[0];
          const quote = match[1];
          const chunkPath = match[2];
          const chunkName = chunkPath.replace('./', '');
          
          // Generate SSR-safe replacement
          // Uses typeof guard to prevent window access in SSR contexts
          // TODO: Add sanitization for resourceBasePath to prevent path manipulation
          const resourceBaseRef = resourceBaseVar('{{widget.wid}}');
          const replacement = `import(((typeof window !== 'undefined' && window) ? ${resourceBaseRef} : '') + ${quote}${chunkName}${quote})`;
          
          s.overwrite(match.index, match.index + fullMatch.length, replacement);
          transformCount++;
        }

        // Pattern 2: Transform static imports from entry file
        // Matches: from "./main.js", from './main.js', from `./main.js`
        // Handles optional whitespace between 'from' and the quote
        const staticImportRegex = /from\s*([`'"])\.\/main\.js\1/g;
        
        while ((match = staticImportRegex.exec(chunk.code)) !== null) {
          const fullMatch = match[0];
          const quote = match[1];
          
          // Replace with templated URL for widget versioning
          const replacement = `from ${quote}{{site.url}}/widget_manager/{{widget.wid}}/{{widget.version}}.js${quote}`;
          
          s.overwrite(match.index, match.index + fullMatch.length, replacement);
          transformCount++;
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
            `Transformed ${transformCount} dynamic import(s) in ${fileName}`
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
