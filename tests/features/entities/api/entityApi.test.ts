import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEntity, getEntities } from '@/features/entities/api/entityApi';

const config = vi.hoisted(() => ({ useMocks: true }));
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@/config/widgetConfig', () => ({
  get USE_MOCKS() {
    return config.useMocks;
  },
}));

vi.mock('@/shared/http/client', () => ({ api: http }));

describe('entityApi con mocks', () => {
  beforeEach(() => {
    config.useMocks = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('devuelve el mock mapeado al dominio sin usar la red', async () => {
    const request = getEntities();
    await vi.runAllTimersAsync();
    const entities = await request;

    expect(entities[0]).toEqual({
      id: '1',
      name: 'First Entity',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-02-20T14:45:00Z',
    });
    expect(http.get).not.toHaveBeenCalled();
  });

  it('filtra por search sin distinguir mayúsculas', async () => {
    const request = getEntities({ search: 'SECOND' });
    await vi.runAllTimersAsync();

    expect((await request).map((entity) => entity.name)).toEqual(['Second Entity']);
  });

  it('rechaza si el signal se cancela durante la espera', async () => {
    const controller = new AbortController();
    const request = getEntities({}, controller.signal);
    controller.abort();

    await expect(request).rejects.toThrow();
  });

  it('crea la entidad y la incluye en la lista siguiente', async () => {
    const creation = createEntity({ name: 'Nueva' });
    await vi.runAllTimersAsync();
    const created = await creation;

    expect(created).toMatchObject({ name: 'Nueva' });
    expect(created.createdAt).toEqual(expect.any(String));

    const list = getEntities({ search: 'nueva' });
    await vi.runAllTimersAsync();
    expect(await list).toEqual([created]);
    expect(http.post).not.toHaveBeenCalled();
  });
});

describe('entityApi sin mocks', () => {
  beforeEach(() => {
    config.useMocks = false;
    http.get.mockReset();
    http.post.mockReset();
  });

  it('GET /entities con search y signal, y mapea la respuesta', async () => {
    http.get.mockResolvedValue({
      data: [{ id: '7', name: 'Remota', created_at: '2024-05-01T00:00:00Z' }],
    });
    const { signal } = new AbortController();

    const entities = await getEntities({ search: 'rem' }, signal);

    expect(http.get).toHaveBeenCalledWith('/entities', { params: { search: 'rem' }, signal });
    expect(entities).toEqual([
      { id: '7', name: 'Remota', createdAt: '2024-05-01T00:00:00Z', updatedAt: undefined },
    ]);
  });

  it('GET /entities sin filtros no envía params', async () => {
    http.get.mockResolvedValue({ data: [] });

    await getEntities();

    expect(http.get).toHaveBeenCalledWith('/entities', { params: undefined, signal: undefined });
  });

  it('POST /entities envía los datos y mapea la entidad creada', async () => {
    http.post.mockResolvedValue({
      data: { id: '8', name: 'Creada', created_at: '2024-05-02T00:00:00Z' },
    });

    const created = await createEntity({ name: 'Creada' });

    expect(http.post).toHaveBeenCalledWith('/entities', { name: 'Creada' }, { signal: undefined });
    expect(created).toMatchObject({ id: '8', createdAt: '2024-05-02T00:00:00Z' });
  });

  it('propaga el error de la red', async () => {
    http.get.mockRejectedValue(new Error('Network Error'));

    await expect(getEntities()).rejects.toThrow('Network Error');
  });
});
