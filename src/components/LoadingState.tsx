import { DCard, DSkeleton } from '@dynamic-framework/ui-react';

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
  switch (variant) {
    case 'list':
      return (
        <div className="d-flex flex-column gap-3">
          {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="d-flex align-items-center gap-3">
              <DSkeleton variant="circular" width={40} height={40} />
              <div className="flex-grow-1">
                <DSkeleton variant="text" width="60%" />
                <DSkeleton variant="text" width="40%" />
              </div>
            </div>
          ))}
        </div>
      );

    case 'card':
      return (
        <DCard>
          <DCard.Body>
            <DSkeleton variant="text" width="40%" height={24} />
            <DSkeleton variant="text" width="100%" />
            <DSkeleton variant="text" width="80%" />
          </DCard.Body>
        </DCard>
      );

    case 'table':
      return (
        <div className="d-flex flex-column gap-2">
          <DSkeleton variant="rectangular" height={40} />
          {Array.from({ length: rows }).map((_, i) => (
            <DSkeleton key={i} variant="rectangular" height={48} />
          ))}
        </div>
      );

    case 'spinner':
    default:
      return (
        <div className="d-flex justify-content-center align-items-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      );
  }
}
