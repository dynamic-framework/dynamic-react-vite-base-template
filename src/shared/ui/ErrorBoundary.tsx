/**
 * ErrorBoundary
 *
 * Re-export of `DErrorBoundary` from `@dynamic-framework/ui-react` to
 * align with the upstream-as-source-of-truth pattern.
 *
 * API (provided by Dynamic UI):
 *   <ErrorBoundary
 *     fallback={({ error, resetErrorBoundary }) => <Fallback ... />}
 *     resetKeys={[someKey]}
 *     onReset={() => {...}}
 *     onError={(error, info) => {...}}
 *   >
 *     {children}
 *   </ErrorBoundary>
 *
 * @see https://react.dynamicframework.dev/latest/?path=/docs/components-derrorboundary
 */
export { DErrorBoundary as ErrorBoundary } from '@dynamic-framework/ui-react';
