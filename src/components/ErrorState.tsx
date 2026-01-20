import { DAlert, DButton } from '@dynamic-framework/ui-react';
import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  color?: 'danger' | 'warning';
}

export function ErrorState({
  message,
  onRetry,
  color = 'danger'
}: ErrorStateProps) {
  return (
    <DAlert color={color} className="d-flex align-items-center gap-3">
      <AlertCircle size={24} />
      <div className="flex-grow-1">
        <p className="mb-0">{message}</p>
      </div>
      {onRetry && (
        <DButton
          onClick={onRetry}
          text="Reintentar"
          variant="outline"
          size="sm"
          iconStart="RefreshCw"
        />
      )}
    </DAlert>
  );
}
