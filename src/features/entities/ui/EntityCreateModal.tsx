/**
 * Example: modal de creación de entidad, registrado como portal del
 * DContextProvider.
 *
 * Recibe el payload del openPortal vía `PortalProps<Payload>` y dispara el
 * cierre con `closePortal()` del context — NO con un onClose prop pasado a
 * DModal (DModal no acepta isOpen/onClose; ver el reporte de Fase A).
 *
 * El botón X del header sí usa onClose, pero es el onClose de DModal.Header,
 * no de DModal. Se conecta al mismo closePortal.
 *
 * Para usar en un widget real:
 *   1. Copiar este archivo a src/components/ (no a _examples/).
 *   2. Reemplazar el body placeholder con el form real.
 *   3. Registrar el componente en availablePortals del DContextProvider de
 *      tu main.tsx.
 *
 * Issues upstream que matizan este patrón:
 *   - https://github.com/dynamic-framework/dynamic-ui/issues/1052
 *     (story de Storybook con openPortal — habría evitado la confusión
 *     que motivó esta reescritura)
 */
import type { PortalProps } from '@dynamic-framework/ui-react';
import { DButton, DModal, useDPortalContext } from '@dynamic-framework/ui-react';
import { useTranslation } from 'react-i18next';

export type EntityCreatePayload = { entityType: string };

export function EntityCreateModal({ payload }: PortalProps<EntityCreatePayload>) {
  const { t } = useTranslation();
  const { closePortal } = useDPortalContext();

  return (
    <DModal name="entity-create" centered>
      <DModal.Header onClose={closePortal} showCloseButton>
        <h5 className="fw-bold">
          {t('examples.entityCreate.title', { type: payload.entityType })}
        </h5>
      </DModal.Header>
      <DModal.Body className="py-3 px-5">
        <p>{t('examples.entityCreate.body')}</p>
        {/* form placeholder — el ejemplo demuestra el patrón, no implementa el form completo */}
      </DModal.Body>
      <DModal.Footer>
        <DButton
          text={t('common.cancel')}
          variant="outline"
          onClick={() => closePortal()}
        />
        <DButton text={t('common.confirm')} />
      </DModal.Footer>
    </DModal>
  );
}
