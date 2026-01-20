import { DAlert, DButton } from '@dynamic-framework/ui-react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  color?: 'danger' | 'warning';
}

export function ErrorState({
  message,
  onRetry,
  color = 'danger'
}: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <DAlert color={color} className="d-flex align-items-center gap-3">
      <AlertCircle size={24} />
      <div className="flex-grow-1">
        <p className="mb-0">{message ?? t('states.error.default')}</p>
      </div>
      {onRetry && (
        <DButton
          onClick={onRetry}
          text={t('states.error.retry')}
          variant="outline"
          size="sm"
          iconStart="RefreshCw"
        />
      )}
    </DAlert>
  );
}
