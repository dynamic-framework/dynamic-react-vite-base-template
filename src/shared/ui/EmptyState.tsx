/**
 * Override de los defaults internos de DDataStateWrapper para inyectar i18n.
 *
 * El markup es idéntico al EmptyState interno de @dynamic-framework/ui-react
 * (byte-by-byte), pero los strings vienen de react-i18next en vez de quedar
 * hardcoded en inglés. Pasado a DDataStateWrapper vía renderEmpty.
 */
import { DButton, DIcon } from '@dynamic-framework/ui-react';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  message?: string;
  icon?: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  message,
  icon = 'FileText',
  actionText,
  onAction
}: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="d-flex flex-column align-items-center justify-content-center p-5 text-center">
      <DIcon
        icon={icon}
        size="3rem"
        className="text-secondary mb-3"
      />
      <p className="text-secondary mb-3">{message ?? t('states.empty.default')}</p>
      {actionText && onAction && (
        <DButton
          onClick={onAction}
          text={actionText}
          variant="outline"
        />
      )}
    </div>
  );
}
