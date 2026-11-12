/**
 * Override de los defaults internos de DDataStateWrapper para inyectar i18n.
 *
 * Reimplementa el markup de ErrorState upstream agregando soporte de
 * react-i18next. Nota importante sobre el icono: NO se pasa `icon` explícito
 * a DAlert — el icono lo deriva DAlert automáticamente desde el `color` vía
 * DContext.iconMap. Este es el patrón canónico del framework.
 */
import { DAlert, DButton } from '@dynamic-framework/ui-react';
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
