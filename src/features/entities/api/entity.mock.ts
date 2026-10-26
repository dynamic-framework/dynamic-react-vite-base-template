/**
 * Datos de prueba de la feature, con la forma del dto: en modo mocks pasan por
 * el mismo mapper que la respuesta real. Solo los importa entityApi.ts, cuando
 * `USE_MOCKS` (vars.use-mocks) es true.
 */
import type { ApiEntity } from './entity.dto';

export const mockEntities: ApiEntity[] = [
  {
    id: '1',
    name: 'First Entity',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-02-20T14:45:00Z',
  },
  {
    id: '2',
    name: 'Second Entity',
    created_at: '2024-02-01T09:00:00Z',
  },
  {
    id: '3',
    name: 'Third Entity',
    created_at: '2024-03-10T16:20:00Z',
    updated_at: '2024-03-12T11:30:00Z',
  },
];
