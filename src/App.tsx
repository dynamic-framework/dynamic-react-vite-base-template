import {
  DCard,
  useDContext
} from '@dynamic-framework/ui-react';
import { useEffect } from 'react';

import { ErrorBoundary } from './components';
import MyComponent from './components/MyComponent';
import { CONTEXT_CONFIG } from './config/widgetConfig';
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
            <MyComponent />
          </DCard.Body>
        </DCard>
      </ErrorBoundary>
    </QueryProvider>
  );
}