/**
 * Template para Mock Data.
 *
 * Los mocks:
 * - Usan tipos de DOMINIO (post-mapper), no tipos de API
 * - Contienen datos realistas y variados
 * - Se activan via widgetConfig.useMocks o VITE_USE_MOCKS=true
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
