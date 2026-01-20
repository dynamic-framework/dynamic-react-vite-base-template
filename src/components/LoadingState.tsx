import { DCard } from '@dynamic-framework/ui-react';
import { useTranslation } from 'react-i18next';

type LoadingVariant = 'spinner' | 'list' | 'card' | 'table';

interface LoadingStateProps {
  variant?: LoadingVariant;
  items?: number;
  rows?: number;
}

export function LoadingState({
  variant = 'spinner',
  items = 3,
  rows = 5
}: LoadingStateProps) {
  const { t } = useTranslation();

  switch (variant) {
    case 'list':
      return (
        <div className="d-flex flex-column gap-3">
          {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="d-flex align-items-center gap-3">
              <div className="placeholder-glow">
                <span className="placeholder rounded-circle" style={{ width: 40, height: 40, display: 'block' }} />
              </div>
              <div className="flex-grow-1 placeholder-glow">
                <span className="placeholder col-6 mb-2" />
                <span className="placeholder col-4" />
              </div>
            </div>
          ))}
        </div>
      );

    case 'card':
      return (
        <DCard>
          <DCard.Body>
            <div className="placeholder-glow">
              <span className="placeholder col-4 mb-3" style={{ height: 24 }} />
              <span className="placeholder col-12 mb-2" />
              <span className="placeholder col-8" />
            </div>
          </DCard.Body>
        </DCard>
      );

    case 'table':
      return (
        <div className="d-flex flex-column gap-2 placeholder-glow">
          <span className="placeholder col-12" style={{ height: 40 }} />
          {Array.from({ length: rows }).map((_, i) => (
            <span key={i} className="placeholder col-12" style={{ height: 48 }} />
          ))}
        </div>
      );

    case 'spinner':
    default:
      return (
        <div className="d-flex justify-content-center align-items-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">{t('states.loading')}</span>
          </div>
        </div>
      );
  }
}
