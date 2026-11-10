/**
 * Hooks de TanStack Query de la feature. La caché y los estados de carga y
 * error son de TanStack Query; las llaves de la feature cuelgan de
 * `entityKeys.all` para invalidarlas por niveles.
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { createEntity, getEntities } from '../api/entityApi';
import type { CreateEntityData, EntityFilters } from '../model/entity';

export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (filters: EntityFilters) => [...entityKeys.lists(), filters] as const,
};

/**
 * Lista de entidades. Cada combinación de filtros tiene su propia entrada en
 * la caché; mientras llega la de unos filtros nuevos se muestra la anterior.
 */
export function useEntities(filters: EntityFilters = {}) {
  return useQuery({
    queryKey: entityKeys.list(filters),
    queryFn: ({ signal }) => getEntities(filters, signal),
    placeholderData: keepPreviousData,
  });
}

/**
 * Crea una entidad e invalida todas las listas al terminar.
 */
export function useCreateEntity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEntityData) => createEntity(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entityKeys.lists() }),
  });
}
