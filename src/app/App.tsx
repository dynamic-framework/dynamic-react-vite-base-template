import {
  DCard,
  useDContext
} from '@dynamic-framework/ui-react';
import { useEffect } from 'react';

import { CONTEXT_CONFIG } from '@/config/widgetConfig';
import HomePage from '@/pages/HomePage';
import { ErrorBoundary } from '@/shared/ui';

import { QueryProvider } from './providers/QueryProvider';

export default function App() {
  const { setContext } = useDContext();

  useEffect(() => {
    setContext(CONTEXT_CONFIG);
  }, [setContext]);

  return (
    <QueryProvider>
      <ErrorBoundary>
        <DCard className="container my-md-14">
          <DCard.Body className="d-flex flex-column gap-4 p-4 p-md-14">
            <HomePage />
          </DCard.Body>
        </DCard>
      </ErrorBoundary>
    </QueryProvider>
  );
}