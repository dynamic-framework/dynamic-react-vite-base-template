import {
  DCard,
  useDContext
} from '@dynamic-framework/ui-react';
import { useEffect } from 'react';

import MyComponent from './components/MyComponent';
import { CONTEXT_CONFIG } from './config/widgetConfig';

export default function App() {
  const { setContext } = useDContext();

  useEffect(() => {
    setContext(CONTEXT_CONFIG);
  }, [setContext]);

  return (
    <DCard className="container my-md-14">
      <DCard.Body className="d-flex flex-column gap-4 p-4 p-md-14">
        <MyComponent />
      </DCard.Body>
    </DCard>
  );
}