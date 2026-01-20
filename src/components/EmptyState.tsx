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
