/**
 * Modal de creación, registrado como portal en `availablePortals` del
 * DContextProvider de src/app/main.tsx y abierto con
 * `openPortal('entity-create', { onCreate })`.
 *
 * Los portales se pintan junto al árbol de App, fuera de su QueryProvider: por
 * eso el modal no usa hooks de TanStack Query y recibe la acción de crear en el
 * payload, desde un componente que sí está dentro.
 *
 * DModal no recibe isOpen ni onClose: el modal se cierra con `closePortal()`
 * del contexto de portales, que también usa la X de DModal.Header.
 */
import type { PortalProps } from '@dynamic-framework/ui-react';
import {
  DButton,
  DInput,
  DModal,
  useDPortalContext,
} from '@dynamic-framework/ui-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CreateEntityData } from '../model/entity';

export type EntityCreatePayload = {
  onCreate: (data: CreateEntityData) => Promise<unknown>;
};

/** Portales de la feature: nombre → payload. */
export type EntityPortals = {
  'entity-create': EntityCreatePayload;
};

export function EntityCreateModal({ payload }: PortalProps<EntityCreatePayload>) {
  const { t } = useTranslation();
  const { closePortal } = useDPortalContext();
  const [name, setName] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError] = useState(false);

  const submit = async () => {
    if (!name.trim() || isPending) {
      return;
    }
    setIsPending(true);
    setIsError(false);
    try {
      await payload.onCreate({ name: name.trim() });
      closePortal();
    } catch {
      setIsError(true);
      setIsPending(false);
    }
  };

  return (
    <DModal name="entity-create" centered>
      <DModal.Header onClose={closePortal} showCloseButton>
        <h5 className="fw-bold">{t('entities.create.title')}</h5>
      </DModal.Header>
      <DModal.Body className="py-3 px-5">
        <DInput
          label={t('entities.create.name')}
          value={name}
          onChange={setName}
          invalid={isError}
          hint={isError ? t('entities.create.error') : undefined}
        />
      </DModal.Body>
      <DModal.Footer>
        <DButton
          text={t('common.cancel')}
          variant="outline"
          onClick={() => closePortal()}
        />
        <DButton
          text={t('common.save')}
          loading={isPending}
          onClick={() => {
            void submit();
          }}
        />
      </DModal.Footer>
    </DModal>
  );
}
