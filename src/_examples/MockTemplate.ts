/**
 * Mock Template — Reference Example
 *
 * This file is a reference scaffold. To use:
 *   1. Copy this file to `src/services/mocks/<entityName>.ts`
 *   2. Rename `Entity` and `mockEntities` to your actual entity name
 *      (convention: `mockEntities` → `mock<Entity>`)
 *   3. Adjust the mock data to your domain
 *
 * Mocks:
 * - Use DOMAIN types (post-mapper), not API types
 * - Contain realistic, varied data
 * - Are toggled via widgetConfig.useMocks or VITE_USE_MOCKS=true
 *
 * This file is excluded from TypeScript compilation
 * (see tsconfig.app.json `exclude`).
 */

import type { Entity } from '../../types';

export const mockEntities: Entity[] = [
  {
    id: '1',
    name: 'First Entity',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-02-20T14:45:00Z',
  },
  {
    id: '2',
    name: 'Second Entity',
    createdAt: '2024-02-01T09:00:00Z',
  },
  {
    id: '3',
    name: 'Third Entity',
    createdAt: '2024-03-10T16:20:00Z',
    updatedAt: '2024-03-12T11:30:00Z',
  },
];
