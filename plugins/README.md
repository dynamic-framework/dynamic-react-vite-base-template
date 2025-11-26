# Transform Dynamic Imports Plugin

A robust Vite/Rollup plugin that transforms dynamic imports to use runtime-configurable base paths with SSR safety and comprehensive configurability.

## Overview

This plugin transforms dynamic import statements in your JavaScript bundles to support runtime-configurable resource base paths. It's particularly useful for widget systems where code needs to be loaded from different base URLs at runtime.

## Features

- ✅ **Robust Entry Detection**: Uses `chunk.isEntry` instead of hardcoded filename matching
- ✅ **Flexible Regex Patterns**: Handles single quotes, double quotes, backticks, and whitespace
- ✅ **SSR-Safe**: Guards window access with `typeof` checks to prevent SSR crashes
- ✅ **Type Safety**: Proper TypeScript types throughout
- ✅ **Source Map Support**: Optional source map regeneration using MagicString
- ✅ **Configurable**: Extensive options for customizing behavior
- ✅ **Observable**: Logging and warnings for transformation tracking
- ✅ **Secure**: Includes TODOs and guidance for runtime path validation

## Installation

The plugin is already integrated into this project. The required dependency is:

```bash
npm install --save-dev magic-string
```

## Usage

### Basic Usage

In your `vite.config.ts`:

```typescript
import { transformDynamicImports } from './plugins/transformDynamicImports';

export default defineConfig({
  plugins: [
    // ... other plugins
    transformDynamicImports(),
  ],
});
```

### Advanced Configuration

```typescript
transformDynamicImports({
  // Custom resource base variable accessor
  resourceBaseVar: (widPlaceholder) => `window.customBasePath["${widPlaceholder}"]`,
  
  // Custom entry chunk detection
  entryNamePredicate: (chunk) => chunk.isEntry || chunk.name === 'custom-entry',
  
  // Enable source map generation
  enableSourceMap: true,
  
  // Customize widget placeholder
  widgetPlaceholder: '{{custom.id}}',
  
  // Customize chunk file pattern
  chunkFilePattern: '.chunk.mjs',
  
  // Customize entry file name
  entryFileName: 'index.js',
  
  // Customize static import URL template
  staticImportUrlTemplate: '{{cdn.url}}/widgets/{{widget.id}}/{{version}}.js',
})
```

## Configuration Options

### `resourceBaseVar`
- **Type**: `(widPlaceholder: string) => string`
- **Default**: `(widPlaceholder) => window["resourceBasePath_${widPlaceholder}"]`
- **Description**: Function that generates the runtime variable reference for the resource base path

### `entryNamePredicate`
- **Type**: `(chunk: OutputChunk) => boolean`
- **Default**: `(chunk) => chunk.isEntry || false`
- **Description**: Predicate to determine which chunks should be processed

### `enableSourceMap`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable regeneration of source maps after transformation

### `widgetPlaceholder`
- **Type**: `string`
- **Default**: `'{{widget.wid}}'`
- **Description**: Placeholder string used in resource base path variable names

### `chunkFilePattern`
- **Type**: `string`
- **Default**: `'.chunk.js'`
- **Description**: File extension pattern to match for dynamic imports

### `entryFileName`
- **Type**: `string`
- **Default**: `'main.js'`
- **Description**: Entry file name to transform static imports from

### `staticImportUrlTemplate`
- **Type**: `string`
- **Default**: `'{{site.url}}/widget_manager/{{widget.wid}}/{{widget.version}}.js'`
- **Description**: Template URL for static import replacements

## How It Works

### Dynamic Import Transformation

**Before:**
```javascript
import('./components/LazyComponent.abc123.chunk.js')
```

**After:**
```javascript
import(((typeof window !== 'undefined' && window) ? window["resourceBasePath_{{widget.wid}}"] : '') + "LazyComponent.abc123.chunk.js")
```

### Static Import Transformation

**Before:**
```javascript
import { something } from './main.js'
```

**After:**
```javascript
import { something } from '{{site.url}}/widget_manager/{{widget.wid}}/{{widget.version}}.js'
```

## SSR Safety

The plugin includes SSR safety guards to prevent crashes in server-side rendering contexts:

```javascript
(typeof window !== 'undefined' && window) ? window["resourceBasePath_{{widget.wid}}"] : ''
```

This ensures that:
1. Window access is checked before use
2. Empty string fallback is provided for SSR contexts
3. No hydration mismatches occur

## Security Considerations

### Path Validation (TODO)

The plugin includes TODO comments highlighting the need for runtime path validation:

```javascript
// TODO: Add sanitization/validation for resourceBasePath at runtime to prevent 
// path traversal attacks if the global variable can be user-influenced.
// Consider implementing: path normalization, allowlist checking, or CSP headers.
```

### Recommended Security Measures

1. **Validate Runtime Base Paths**: Implement validation in your application code
2. **Use Content Security Policy (CSP)**: Restrict allowed script sources
3. **Path Normalization**: Normalize paths to prevent traversal attacks
4. **Allowlist Checking**: Validate base paths against known-good values

## Testing

The plugin has been tested with:
- Various quote styles (single, double, backticks)
- Different whitespace patterns
- Multiple chunk files
- SSR environments
- Source map generation

To test the plugin with your build:

```bash
npm run build
```

Look for plugin warnings in the output:
```
[plugin transform-dynamic-imports] Transformed 1 dynamic import(s) in main.js
[plugin transform-dynamic-imports] Total transformations applied: 1
```

## Troubleshooting

### No transformations applied

If you see the warning "No dynamic imports were transformed", this could mean:

1. **No code-split chunks**: Your app doesn't use dynamic imports (expected)
2. **Regex mismatch**: The chunk file pattern doesn't match your build output
3. **Entry detection**: The entry predicate doesn't match your chunks

**Solution**: Check your Rollup output configuration and adjust plugin options accordingly.

### Source maps misaligned

If debugging doesn't work correctly after transformation:

1. Enable source map regeneration: `enableSourceMap: true`
2. Check that your build configuration generates source maps
3. Verify that source maps are properly linked in the build output

## Backward Compatibility

- Default options preserve original behavior
- Works seamlessly with existing build configurations
- More future-proof than hardcoded filename matching

## Migration from Hardcoded Implementation

If migrating from a hardcoded approach:

1. Remove hardcoded filename checks
2. Use the default configuration first
3. Test thoroughly with code-split chunks
4. Customize options as needed

## Contributing

When modifying this plugin:

1. Maintain backward compatibility
2. Add tests for new features
3. Update this documentation
4. Follow the existing code style
5. Include JSDoc comments for new options

## License

Part of the Dynamic Framework Vite Base Template project.
