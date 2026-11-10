/**
 * Traduce el dto de la API al tipo de dominio. Es una función pura: los
 * cambios de forma de la API se absorben aquí y no llegan a hooks/ ni a ui/.
 */
import type { ApiEntity } from '../api/entity.dto';

import type { Entity } from './entity';

export function toEntity(dto: ApiEntity): Entity {
  return {
    id: dto.id,
    name: dto.name,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}
