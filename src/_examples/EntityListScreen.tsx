/**
 * Entity List Screen — Reference Example
 *
 * This file is a reference scaffold demonstrating how to compose:
 *   - useEntities (from src/hooks/, after copying QueryHookTemplate)
 *   - DataStateWrapper (loading + error + empty states unified)
 *   - DInputSearch with debounced filtering
 *   - DModal for "Add new" workflow
 *   - useTranslation for i18n (uses examples.entityList.* keys)
 *   - i18n state messages via DataStateWrapper defaults (states.* keys)
 *
 * To use:
 *   1. Copy this file to `src/screens/<EntityName>ListScreen.tsx`
 *   2. Replace `Entity` and `useEntities` references with your real entity
 *   3. Adapt the modal form to your entity's fields
 *   4. Adjust i18n keys under `examples.entityList.*` to your domain
 *
 * This file is excluded from TypeScript compilation
 * (see tsconfig.app.json `exclude`).
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DButton,
  DInputSearch,
  DListGroup,
  DListGroupItem,
  DModal,
  DInput,
} from '@dynamic-framework/ui-react';
import { DataStateWrapper } from '../components';
import { useEntities, useCreateEntity } from '../hooks/useEntity';
import type { Entity } from '../types';

export default function EntityListScreen() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');

  const entitiesQuery = useEntities();
  const createEntity = useCreateEntity();

  const filteredEntities = useMemo(() => {
    if (!entitiesQuery.data) return [];
    const q = searchQuery.toLowerCase();
    return entitiesQuery.data.filter((e: Entity) =>
      e.name.toLowerCase().includes(q),
    );
  }, [entitiesQuery.data, searchQuery]);

  const handleCreate = async () => {
    if (!newEntityName.trim()) return;
    await createEntity.mutateAsync({ name: newEntityName.trim() });
    setNewEntityName('');
    setModalOpen(false);
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h4 mb-0">{t('examples.entityList.title')}</h1>
        <DButton
          iconStart="Plus"
          variant="primary"
          size="sm"
          onClick={() => setModalOpen(true)}
        >
          {t('examples.entityList.addNew')}
        </DButton>
      </div>

      <div className="mb-3">
        <DInputSearch
          placeholder={t('common.placeholder')}
          value={searchQuery}
          onChange={(value) => setSearchQuery(value)}
          debounce={300}
        />
      </div>

      <DataStateWrapper
        isLoading={entitiesQuery.isLoading}
        isError={entitiesQuery.isError}
        data={filteredEntities}
        onRetry={() => entitiesQuery.refetch()}
        emptyMessage={t('examples.entityList.empty')}
        errorMessage={t('examples.entityList.error')}
        loadingVariant="list"
        loadingItems={5}
      >
        {(entities) => (
          <DListGroup>
            {entities.map((entity) => (
              <DListGroupItem key={entity.id}>
                {entity.name}
              </DListGroupItem>
            ))}
          </DListGroup>
        )}
      </DataStateWrapper>

      <DModal
        name="entity-create"
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
      >
        <DModal.Header>
          <h2 className="h5 mb-0">{t('examples.entityList.modalTitle')}</h2>
        </DModal.Header>
        <DModal.Body>
          <DInput
            label={t('examples.entityList.fieldName')}
            value={newEntityName}
            onChange={(value) => setNewEntityName(value)}
            autoFocus
          />
        </DModal.Body>
        <DModal.Footer>
          <DButton variant="link" onClick={() => setModalOpen(false)}>
            {t('common.cancel')}
          </DButton>
          <DButton
            variant="primary"
            onClick={handleCreate}
            disabled={!newEntityName.trim() || createEntity.isPending}
          >
            {t('common.save')}
          </DButton>
        </DModal.Footer>
      </DModal>
    </div>
  );
}
