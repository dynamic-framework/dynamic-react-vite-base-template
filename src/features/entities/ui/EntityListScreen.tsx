/**
 * Lista de entidades con búsqueda y botón de creación.
 *
 * - DInput con iconStart="Search" y useDebouncedValue: la query se lanza
 *   cuando se deja de escribir, no en cada tecla.
 * - DDataStateWrapper pinta carga, error o vacío, en ese orden, y entrega los
 *   datos a la lista cuando los hay.
 * - El modal de creación se abre con openPortal; el portal está registrado en
 *   el DContextProvider de src/app/main.tsx y recibe la mutación en el
 *   payload, porque se pinta fuera del QueryProvider.
 */
import {
  DButton,
  DDataStateWrapper,
  DInput,
  DListGroup,
  useDPortalContext,
} from '@dynamic-framework/ui-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui';

import { useCreateEntity, useEntities } from '../hooks/useEntities';

import type { EntityPortals } from './EntityCreateModal';

const SEARCH_DEBOUNCE = 300; // ms

export default function EntityListScreen() {
  const { t } = useTranslation();
  const { openPortal } = useDPortalContext<EntityPortals>();

  const [searchQuery, setSearchQuery] = useState('');
  const search = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE);

  const { data, isLoading, isError, refetch } = useEntities({ search });
  const { mutateAsync: createEntity } = useCreateEntity();
  const retry = () => {
    void refetch();
  };

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
          text={t('entities.list.create')}
          iconStart="Plus"
          onClick={() => openPortal('entity-create', { onCreate: createEntity })}
        />
      </div>

      <DDataStateWrapper
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={retry}
        renderLoading={<LoadingState variant="list" items={5} />}
        renderEmpty={<EmptyState message={t('entities.list.empty')} />}
        renderError={<ErrorState message={t('entities.list.error')} onRetry={retry} />}
      >
        {(entities) => (
          <DListGroup ariaLabel={t('entities.list.title')}>
            {entities.map((entity) => (
              <DListGroup.Item key={entity.id}>{entity.name}</DListGroup.Item>
            ))}
          </DListGroup>
        )}
      </DDataStateWrapper>
    </div>
  );
}
