import {
  DButton,
  DCard,
  useDContext,
} from '@dynamic-framework/ui-react';
import {
  lazy,
  Suspense,
  useEffect,
  useState,
} from 'react';

import MyComponent from './components/MyComponent';
import { CONTEXT_CONFIG } from './config/widgetConfig';

const ImportedComponent = lazy(() => import('./components/ImportComponent'));

export default function App() {
  const { setContext } = useDContext();
  const [loadOnDemand, setLoadOnDemand] = useState(false);
  const OnDemandComponent = loadOnDemand ? lazy(() => import('./components/OnDemandComponent')) : null;

  useEffect(() => {
    setContext(CONTEXT_CONFIG);
  }, [setContext]);

  return (
    <DCard className="container my-md-14">
      <DCard.Body className="d-flex flex-column gap-4 p-4 p-md-14">
        <MyComponent />
        <div className="d-flex flex-column gap-4">
          <Suspense fallback={<div>Cargando...</div>}>
            <ImportedComponent />
          </Suspense>
          <div>
            <DButton
              text={'Cargar componente extra'}
              disabled={loadOnDemand}
              onClick={() => setLoadOnDemand(true)}
              size="sm"
            />
          </div>
          {OnDemandComponent && (
            <Suspense fallback={<div>Cargando componente bajo demanda...</div>}>
              <OnDemandComponent />
            </Suspense>
          )}
        </div>
      </DCard.Body>
    </DCard>
  );
}
