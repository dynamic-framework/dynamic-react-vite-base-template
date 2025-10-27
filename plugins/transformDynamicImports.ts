/* eslint-disable @typescript-eslint/no-explicit-any */

export const transformDynamicImports = () => {
  return {
    name: 'transform-dynamic-imports',

    // Hook into the generateBundle phase of the build
    // to modify the output code
    // https://rollupjs.org/guide/en/#generatebundle
    generateBundle(_options: any, bundle: { [s: string]: unknown; } | ArrayLike<unknown>) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if ((chunk as any).type === 'chunk' && fileName === 'main.js') {

          // Transform dynamic imports to use resourceBasePath
          // e.g. import("./12345.chunk.js") -> import(window['resourceBasePath-{{widget.wid}}'] + '12345.chunk.js')
          (chunk as any).code = (chunk as any).code.replace(
            /import\("\.\/([^"]+\.chunk\.js)"\)/g,
            (_match: string, chunkFile: string) => {
              return `import(window['resourceBasePath-{{widget.wid}}'] + '${chunkFile}')`;
            }
          );
        }

        // Update chunk file references to use widget manager path
        // e.g. from "./main.js" -> from "{{site.url}}/widget_manager/{{widget.wid}}/{{widget.version}}.js"
        if (fileName.includes('.chunk.js')) {
          (chunk as any).code = (chunk as any).code.replace(
            /from"\.\/main\.js"/g,
            `from "{{site.url}}/widget_manager/{{widget.wid}}/{{widget.version}}.js"`
          );
        }
      }
    }
  };
};