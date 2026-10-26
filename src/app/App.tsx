import {
  DAlert,
  DCard,
  useDContext
} from '@dynamic-framework/ui-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { CONTEXT_CONFIG, getMissingVariables } from '@/config/widgetConfig';
import HomePage from '@/pages/HomePage';
import { ErrorBoundary } from '@/shared/ui';

import { QueryProvider } from './providers/QueryProvider';

/** Lista las variables obligatorias que Modyo no resolvió. */
function MissingVariables({ names }: { names: string[] }) {
  const { t } = useTranslation();

  return (
    <DAlert color="danger">
      <p className="fw-bold mb-2">{t('config.missing.title')}</p>
      <p className="mb-2">{t('config.missing.description')}</p>
      <ul className="mb-0">
        {names.map((name) => (
          <li key={name}><code>{name}</code></li>
        ))}
      </ul>
    </DAlert>
  );
}

export default function App() {
  const { setContext } = useDContext();
  const missingVariables = getMissingVariables();

  useEffect(() => {
    setContext(CONTEXT_CONFIG);
  }, [setContext]);

  return (
    <QueryProvider>
      <ErrorBoundary>
        <DCard className="container my-md-14">
          <DCard.Body className="d-flex flex-column gap-4 p-4 p-md-14">
            {missingVariables.length > 0
              ? <MissingVariables names={missingVariables} />
              : <HomePage />}
          </DCard.Body>
        </DCard>
      </ErrorBoundary>
    </QueryProvider>
  );
}
