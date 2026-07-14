import type { Plugin } from 'vite';

/**
 * Escapes the exact JS string literals "{{" and "}}" in the bundle output.
 *
 * Unicode escapes (\u007B\u007B = {{ and \u007D\u007D = }}) are:
 *  - Transparent to JavaScript: interpreted correctly at runtime
 *  - Invisible to Liquid: the `{{` pattern no longer exists in the source text
 */
export default function escapeLiquidInStrings(): Plugin {
  return {
    name: 'escape-liquid-in-strings',
    apply: 'build' as const,
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.code) {
          chunk.code = chunk.code
            .replace(/"\{\{"/g, '"\\u007B\\u007B"')
            .replace(/"\}\}"/g, '"\\u007D\\u007D"');
        }
      }
    },
  };
}
