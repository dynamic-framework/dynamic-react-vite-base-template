// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { toEntity } from '@/features/entities/model/entity.mapper';

describe('toEntity', () => {
  it('traduce los campos del dto al dominio', () => {
    expect(toEntity({
      id: '1',
      name: 'Uno',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    })).toEqual({
      id: '1',
      name: 'Uno',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    });
  });

  it('deja updatedAt sin valor si el dto no lo trae', () => {
    const entity = toEntity({ id: '2', name: 'Dos', created_at: '2024-01-01T00:00:00Z' });

    expect(entity.updatedAt).toBeUndefined();
  });

  it('no copia campos del dto que el dominio no declara', () => {
    const dto = { id: '3', name: 'Tres', created_at: '2024-01-01T00:00:00Z', extra: true };

    expect(Object.keys(toEntity(dto))).toEqual(['id', 'name', 'createdAt', 'updatedAt']);
  });
});
