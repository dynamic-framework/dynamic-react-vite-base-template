/**
 * LoadingState con variantes de skeleton (list/card/table) sobre el spinner base.
 *
 * Aporte propio sobre upstream:
 *   - Variantes skeleton list/card/table (upstream solo trae spinner).
 *   - i18n del ariaLabel vía react-i18next (upstream usa string hardcoded).
 *
 * Patrón copiado del upstream para no perder accesibilidad:
 *   - aria-busy="true" + aria-live="polite" en el contenedor externo de cada
 *     variante (patrón observado en
 *     @dynamic-framework/ui-react@2.4.0 → src/components/DDataStateWrapper/
 *     components/LoadingState.tsx).
 *
 * Pasado a DDataStateWrapper vía renderLoading.
 *
 * Las variantes skeleton son aporte propio sin issue upstream — no hay
 * request abierto pidiendo skeletons en el framework. Si en el futuro se
 * agregan, considerar simplificar este archivo.
 *
 * Re-export upstream pendiente:
 *   https://github.com/dynamic-framework/dynamic-ui/issues/1049
 */
import { DCard } from '@dynamic-framework/ui-react';
import { useTranslation } from 'react-i18next';

type LoadingVariant = 'spinner' | 'list' | 'card' | 'table';

interface LoadingStateProps {
  variant?: LoadingVariant;
  /** Number of skeleton items rendered by the `list` variant. */
  items?: number;
  /** Number of skeleton rows rendered by the `table` variant (ignored otherwise). */
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
        <div
          className="d-flex flex-column gap-3"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="visually-hidden">{t('states.loading')}</span>
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
        <div aria-busy="true" aria-live="polite">
          <span className="visually-hidden">{t('states.loading')}</span>
          <DCard>
            <DCard.Body>
              <div className="placeholder-glow">
                <span className="placeholder col-4 mb-3" style={{ height: 24 }} />
                <span className="placeholder col-12 mb-2" />
                <span className="placeholder col-8" />
              </div>
            </DCard.Body>
          </DCard>
        </div>
      );

    case 'table':
      return (
        <div
          className="d-flex flex-column gap-2 placeholder-glow"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="visually-hidden">{t('states.loading')}</span>
          <span className="placeholder col-12" style={{ height: 40 }} />
          {Array.from({ length: rows }).map((_, i) => (
            <span key={i} className="placeholder col-12" style={{ height: 48 }} />
          ))}
        </div>
      );

    case 'spinner':
    default:
      return (
        <div
          className="d-flex justify-content-center align-items-center p-5"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">{t('states.loading')}</span>
          </div>
        </div>
      );
  }
}
