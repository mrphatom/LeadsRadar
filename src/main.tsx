import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { EnterpriseErrorBoundary } from './components/EnterpriseErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EnterpriseErrorBoundary>
      <App />
    </EnterpriseErrorBoundary>
  </StrictMode>,
);

