/**
 * Mock data for the Entity domain (example scaffold).
 *
 * Mocks use DOMAIN types (post-mapper), not API types, and are returned by the
 * repository when `widgetConfig.useMocks` (vars.use-mocks) is true. Copy this
 * file to `src/services/mocks/<entityName>.ts` and rename for your own domain.
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
