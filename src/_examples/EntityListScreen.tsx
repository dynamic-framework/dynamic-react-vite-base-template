/**
 * Example: lista de entidades con búsqueda debounced y modal de creación.
 *
 * Demuestra los patrones canónicos del framework:
 *   - DInput con iconStart="Search" + useDebouncedValue (no existe DInputSearch).
 *   - DContextProvider + openPortal/closePortal para modales (NO isOpen/onClose).
 *   - DDataStateWrapper upstream con render props para loading/empty/error.
 *
 * Self-contained: este archivo embebe su propio DContextProvider con
 * `availablePortals` para que el ejemplo sea copy-runnable en aislamiento.
 *
 * Al adaptar este patrón a un widget de producción:
 *   1. Mover `availablePortals` al DContextProvider de tu main.tsx — NO crear
 *      un DContextProvider anidado en producción.
 *   2. Remover el wrapper DContextProvider local de este componente.
 *
 * El provider anidado existe únicamente porque este archivo está excluido de
 * tsconfig.app.json y vive como referencia, no como producción.
 *
 * Issues upstream que matizan este patrón:
 *   - https://github.com/dynamic-framework/dynamic-ui/issues/1051
 *     (debounce nativo en DInput → useDebouncedValue dejaría de ser necesario)
 *   - https://github.com/dynamic-framework/dynamic-ui/issues/1052
 *     (story de Storybook con openPortal para evitar confusión sobre el patrón)
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DContextProvider,
  DButton,
  DInput,
  DDataStateWrapper,
  useDPortalContext,
} from '@dynamic-framework/ui-react';

import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { EmptyState, ErrorState, LoadingState } from '../components';
import type { Entity } from '../types';

import { EntityCreateModal, type EntityCreatePayload } from './EntityCreateModal';

type EntityPortalPayloads = {
  'entity-create': EntityCreatePayload;
};

/**
 * Mock data fetch para fines del ejemplo. En un widget real, esto sería un
 * hook con TanStack Query (ej. useEntitiesQuery) sobre un repository — ver
 * QueryHookTemplate.ts y RepositoryTemplate.ts en este mismo directorio.
 *
 * El parámetro `search` se acepta pero no se aplica en este stub; el ejemplo
 * sigue ilustrando cómo el valor debounced se conecta al hook de datos.
 */
function useMockEntities(search: string) {
  // `search` se acepta para ilustrar el contrato del hook (recibe el valor
  // debounced y dispararía una query). En este stub no se aplica filtrado.
  void search;
  return {
    data: undefined as Entity[] | undefined,
    isLoading: false,
    isError: false,
    refetch: () => {},
  };
}

function EntityList() {
  const { t } = useTranslation();
  const { openPortal } = useDPortalContext<EntityPortalPayloads>();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const { data, isLoading, isError, refetch } = useMockEntities(debouncedSearch);

  return (
    <div className="p-4">
      <div className="d-flex gap-3 mb-4 align-items-end">
        <div className="flex-grow-1">
          <DInput
            iconStart="Search"
            placeholder={t('common.searchPlaceholder')}
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        <DButton
          text={t('examples.entityList.create')}
          iconStart="Plus"
          onClick={() => openPortal('entity-create', { entityType: 'product' })}
        />
      </div>

      <DDataStateWrapper
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={refetch}
        renderLoading={<LoadingState variant="list" items={5} />}
        renderEmpty={<EmptyState message={t('states.empty.default')} />}
        renderError={
          <ErrorState message={t('states.error.default')} onRetry={refetch} />
        }
      >
        {(entities) => (
          <ul className="list-group">
            {entities.map((entity) => (
              <li key={entity.id} className="list-group-item">
                {entity.name}
              </li>
            ))}
          </ul>
        )}
      </DDataStateWrapper>
    </div>
  );
}

/**
 * Provider self-contained — ver header del archivo para guía sobre cómo
 * adaptarlo a producción.
 */
export default function EntityListScreen() {
  return (
    <DContextProvider<EntityPortalPayloads>
      portalName="entityListPortal"
      availablePortals={{ 'entity-create': EntityCreateModal }}
    >
      <EntityList />
    </DContextProvider>
  );
}
