import { DContextProvider } from '@dynamic-framework/ui-react';
import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import './config/i18nConfig';

import App from './App';

import '@dynamic-framework/ui-react/dist/css/dynamic-ui.css';
import './styles/base.scss';

const root = ReactDOM.createRoot(document.getElementById('widgetName') as Element);
root.render(
  <StrictMode>
    <DContextProvider>
      <App />
    </DContextProvider>
  </StrictMode>,
);

console.log(`React version (${React.version})`);
